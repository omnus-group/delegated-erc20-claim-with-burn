// SPDX-License-Identifier: MIT

/**
 * @title DelegatedERC20ClaimWithBurn.sol.
 */

/**
 * @notice Implementation of an ERC20 claim mechansism. This contract uses a merkle tree to authorise
 * claims from allowlist addresses, including claims made from delegated addresses. In all cases
 * the allowance from the leaf in the tree is distributed to the allowance holder NOT the delegate.
 * The delegate in the leaf merely informs the contract of the address that can make the call. In
 * the case where there is no delegate this will be the allowance holder, i.e. the allowance holder
 * address is in the tree as both the allowance holder and the delegate.
 *
 * A single allowance can potentially be represented by multiple leafs, since the claimed balance is
 * tracked against the allowance holder address. This allows a tree structure whereby an allowance holder
 * can claim from their own address, or with a call from a delegated address, or even delegated addresses.
 *
 * Leaf format is allowanceHolder | delegate | allowanceAmount
 *
 * The claim period has a start and end date. Claims cannot be made before the start date or after the end
 * date. After the end date anyone can call the contract to burn unclaimed token.
 *
 * For burning to work the claimable ERC20 must be burnable using ERC20Burnable.
 */

/**
 * @author omnus (https://omn.us)
 */

pragma solidity 0.8.24;

// Interface for this contract.
import {IDelegatedERC20ClaimWithBurn} from "./IDelegatedERC20ClaimWithBurn.sol";
// OZ's SafeERC20.
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// Interface for OZ ERC20Burnable
import {IERC20Burnable} from "../OpenZeppelin/IERC20Burnable.sol";
// The MerkleProof library, which provides methods to validate leaves and proofs against the merkle root.
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract DelegatedERC20ClaimWithBurn is IDelegatedERC20ClaimWithBurn {
  using SafeERC20 for IERC20;

  // The token being claimed. Note that this contract must hold sufficient balance of this
  // token for the claims being made.
  IERC20Burnable public immutable claimableERC20;

  // The merkle root is set on the constructor.
  bytes32 public immutable merkleRoot;

  // The start date for claims. Before this point claims cannot be made. Set in the constructor.
  uint256 public immutable claimStart;

  // The end date for claims. After this point claims are CLOSED and remaining tokens held in this contract
  // can be burnt by ANYONE.
  uint256 public immutable claimEnd;

  // claimedAmount: The amount that a given allowance holder has already claimed.
  mapping(address => uint256) public claimedAmount;

  /**
   * @dev constructor
   *
   * @param claimableERC20_ The address of the ERC20 being claimed
   * @param merkleRoot_ Merkle root for the allowlist
   * @param claimStart_ The timestamp after which claims can occur
   * @param claimEnd_ The timestamp after which claims cannot occur, and remaining balance can be burned
   */
  constructor(
    address claimableERC20_,
    bytes32 merkleRoot_,
    uint256 claimStart_,
    uint256 claimEnd_
  ) {
    if (claimableERC20_ == address(0)) {
      revert("Claimable ERC20 must be set");
    }
    if (merkleRoot_ == bytes32(0)) {
      revert("Merkle root must be set");
    }
    if (claimStart_ == 0) {
      revert("Claim start must be set");
    }
    if (claimEnd_ <= claimStart_) {
      revert("Claim end must be after claim start");
    }
    claimableERC20 = IERC20Burnable(claimableERC20_);
    claimStart = claimStart_;
    claimEnd = claimEnd_;
    merkleRoot = merkleRoot_;
  }

  /**
   * @dev onlyWhenClaimOpen
   *
   * This modifier will revert if the claim status is not OPEN
   */
  modifier onlyWhenClaimOpen() {
    if (getClaimPeriodStatusEnum() != ClaimPeriodStatus.Open)
      revert("Claim is not open");
    _;
  }

  /**
   * @dev onlyWhenClaimEnded
   *
   * This modifier will revert if the claim status is not ENDED
   */
  modifier onlyWhenClaimEnded() {
    if (getClaimPeriodStatusEnum() != ClaimPeriodStatus.Ended)
      revert("Claim is not yet ended");
    _;
  }

  /**
   * @dev getClaimPeriodStatusEnum
   *
   * Public function to return the current status of the claim as an ENUM.
   *
   * @return status_ The current status as an Enum of type ClaimPeriodStatus.
   */
  function getClaimPeriodStatusEnum()
    public
    view
    returns (ClaimPeriodStatus status_)
  {
    if (block.timestamp > claimStart && block.timestamp < claimEnd) {
      return (ClaimPeriodStatus.Open);
    }
    if (block.timestamp <= claimStart) {
      return (ClaimPeriodStatus.Before);
    }
    if (block.timestamp >= claimEnd) {
      return (ClaimPeriodStatus.Ended);
    }
  }

  /**
   * @dev getClaimPeriodStatus
   *
   * External function to return the current status of the claim as a string.
   *
   * @return status_ The current status as a string.
   */
  function getClaimPeriodStatus()
    external
    view
    returns (string memory status_)
  {
    ClaimPeriodStatus currentStatus = getClaimPeriodStatusEnum();
    if (currentStatus == ClaimPeriodStatus.Open) {
      return ("open");
    }
    if (currentStatus == ClaimPeriodStatus.Before) {
      return ("before");
    }
    if (currentStatus == ClaimPeriodStatus.Ended) {
      return ("ended");
    }
  }

  /**
   * @dev claim
   *
   * Validate caller eligiblity and claim ERC20
   *
   * @param allowanceHolder_ The address that holds an allowance. This need not be the caller, in the
   * case where the caller is a delegate of the allowance holder. But they need to have an unclaimed
   * allowance, i.e. initial allowance - claimed allowance > 0.
   * @param allowanceAmount_ The initial allowance that this holder is entitled to.
   * @param claimAmount_ The amount that the user is claiming in this call.
   * @param proof_ The calculated proof.
   */
  function claim(
    address allowanceHolder_,
    uint256 allowanceAmount_,
    uint256 claimAmount_,
    bytes32[] calldata proof_
  ) external onlyWhenClaimOpen {
    _checkRemainingAllowance(allowanceHolder_, allowanceAmount_, claimAmount_);

    checkMerkleTree(proof_, allowanceHolder_, allowanceAmount_, msg.sender);

    _recordClaim(allowanceHolder_, claimAmount_);

    _distributeClaim(allowanceHolder_, claimAmount_);

    emit AllowanceClaimed(allowanceHolder_, claimAmount_);
  }

  /**
   * @dev checkMerkleTree
   *
   * A public method to check if a leaf hash and proof pass the merkle check. It will revert if it does not.
   *
   * @param proof_ The provided proof
   * @param allowanceHolder_ The address that holds an allowance. This need not be the caller, in the
   * case where the caller is a delegate of the allowance holder. But they need to have an unclaimed
   * allowance, i.e. initial allowance - claimed allowance > 0.
   * @param allowanceAmount_ The initial allowance that this holder is entitled to.
   * Leaf format is allowanceHolder | delegate | allowanceAmount
   * @param caller_ The msg.sender on this txn.
   */
  function checkMerkleTree(
    bytes32[] calldata proof_,
    address allowanceHolder_,
    uint256 allowanceAmount_,
    address caller_
  ) public view {
    bytes32 leafHash = keccak256(
      abi.encode(allowanceHolder_, caller_, allowanceAmount_)
    );
    if (!MerkleProof.verify(proof_, merkleRoot, leafHash)) {
      revert("Invalid claim details");
    }
  }

  /**
   * @dev burnUnclaimed
   *
   * Burn any unclaimed token. Can only be called after the claim has ended.
   *
   * Note - token must be burnable.
   */
  function burnUnclaimed() external onlyWhenClaimEnded {
    uint256 burntBalance = claimableERC20.balanceOf(address(this));

    IERC20Burnable(claimableERC20).burn(burntBalance);

    emit UnclaimedAllowanceBurned(burntBalance);
  }

  /**
   * @dev _checkRemainingAllowance
   *
   * An internal method to check that the allowance holder will not receive more token than their
   * total allowance.
   *
   * @param allowanceHolder_ The address that holds an allowance. This need not be the caller, in the
   * case where the caller is a delegate of the allowance holder. But they need to have an unclaimed
   * allowance, i.e. initial allowance - claimed allowance > 0.
   * @param allowanceAmount_ The initial allowance that this holder is entitled to.
   * @param claimAmount_ The amount that the user is claiming in this call.
   */
  function _checkRemainingAllowance(
    address allowanceHolder_,
    uint256 allowanceAmount_,
    uint256 claimAmount_
  ) internal view {
    if ((claimedAmount[allowanceHolder_] + claimAmount_) > allowanceAmount_) {
      revert("Claim exceeds allowance");
    }
  }

  /**
   * @dev _recordClaim
   *
   * An internal method to recored that the allowance holder has made a claim.
   *
   * @param allowanceHolder_ The address for which the allowance has been claimed.
   * @param allowanceClaimed_ The amount of token that has been claimed.
   */
  function _recordClaim(
    address allowanceHolder_,
    uint256 allowanceClaimed_
  ) internal {
    claimedAmount[allowanceHolder_] += allowanceClaimed_;
  }

  /**
   * @dev _distributeClaim
   *
   * An internal method to transfer ERC20 to the allowance holder.
   *
   * @param allowanceHolder_ The address for which the allowance has been claimed.
   * @param allowanceClaimed_ The amount of token that has been claimed.
   */
  function _distributeClaim(
    address allowanceHolder_,
    uint256 allowanceClaimed_
  ) internal {
    claimableERC20.transfer(allowanceHolder_, allowanceClaimed_);
  }
}
