// SPDX-License-Identifier: MIT

/**
 * @title DelegatedERC20ClaimWithBurn.sol. Interface for DelegatedERC20ClaimWithBurn.sol.
 *
 * DelegatedERC20ClaimWithBurn.sol is an implementation of an ERC20 claim mechansism. This contract
 * uses a merkle tree to authorise claims from allowlists addresses, including claims made from delegated
 * addresses. In all cases the allowance from the leaf in the tree is distributed to the allowance holder
 * NOT the delegate. The delegate in the leaf merely informs the contract of the address that can make the
 * call. In the case where there is no delegate this will be the allowance holder.
 *
 * A single allowance can potentially be represented by multiple leafs, since the claimed balance is
 * tracked against the allowance holder address. This allows a tree structure whereby an allowance holder
 * can claim from their own address, or with a call from a delegated address, or even delegated addresses.
 *
 * Leaf format is allowanceHolder | delegate | allowanceAmount
 *
 * The claim period has a start and end date. Claims cannot be made before the start date or after the end
 * date. After the end date anyone can call the contrac to burn unclaimed token.
 *
 * Note that for burning to work the claimable ERC20 must be burnable using ERC20Burnable.
 *
 * @author omnus (https://omn.us)
 */

pragma solidity 0.8.24;

interface IDelegatedERC20ClaimWithBurn {
  // enum for the status of the claim
  enum ClaimPeriodStatus {
    Before,
    Open,
    Ended
  }

  // Event emitted when an allowance is claimed:
  event AllowanceClaimed(address allowanceHolder, uint256 allowanceClaimed);

  // Event emitted when the unclaimed balance is burned:
  event UnclaimedAllowanceBurned(uint256 burnedBalance);

  /**
   * @dev getClaimPeriodStatusEnum
   *
   * Public function to return the current status of the claim as an ENUM.
   *
   * @return status_ The current status as an Enum of type ClaimPeriodStatus.
   */
  function getClaimPeriodStatusEnum()
    external
    view
    returns (ClaimPeriodStatus status_);

  /**
   * @dev getClaimPeriodStatus
   *
   * External function to return the current status of the claim as a string.
   *
   * @return status_ The current status as a string.
   */
  function getClaimPeriodStatus() external view returns (string memory status_);

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
  ) external;

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
  ) external view;

  /**
   * @dev burnUnclaimed
   *
   * Burn any unclaimed token. Can only be called after the claim has ended.
   *
   * Note - token must be burnable.
   */
  function burnUnclaimed() external;
}
