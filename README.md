# delegated-erc20-claim-with-burn

Abstract contract for claiming an ERC20 allowance, both as the allowance holder and as an authorised delegate.

Note - in ALL cases the allowance goes to the allowance holder. A delegate is merely authorised to submit a claim
transaction (useful when allowlists addresses are in the deep freeze).

Implementation of an ERC20 claim mechansism. This contract uses a merkle tree to authorise
claims from allowlist addresses, including claims made from delegated addresses. In all cases
the allowance from the leaf in the tree is distributed to the allowance holder NOT the delegate.
The delegate in the leaf merely informs the contract of the address that can make the call. In
the case where there is no delegate this will be the allowance holder, i.e. the allowance holder
address is in the tree as both the allowance holder and the delegate.

A single allowance can potentially be represented by multiple leafs, since the claimed balance is
tracked against the allowance holder address. This allows a tree structure whereby an allowance holder
can claim from their own address, or with a call from a delegated address, or even delegated addresses.

Leaf format is allowanceHolder | delegate | allowanceAmount

The claim period has a start and end date. Claims cannot be made before the start date or after the end
date. After the end date anyone can call the contract to burn unclaimed token.

For burning to work the claimable ERC20 must be burnable using ERC20Burnable.

# Solidity API

## DelegatedERC20ClaimWithBurn

### claimableERC20

```solidity
contract IERC20Burnable claimableERC20
```

### merkleRoot

```solidity
bytes32 merkleRoot
```

### claimStart

```solidity
uint256 claimStart
```

### claimEnd

```solidity
uint256 claimEnd
```

### claimedAmount

```solidity
mapping(address => uint256) claimedAmount
```

### constructor

```solidity
constructor(address claimableERC20_, bytes32 merkleRoot_, uint256 claimStart_, uint256 claimEnd_) public
```

_constructor_

#### Parameters

| Name             | Type    | Description                                                                        |
| ---------------- | ------- | ---------------------------------------------------------------------------------- |
| claimableERC20\_ | address | The address of the ERC20 being claimed                                             |
| merkleRoot\_     | bytes32 | Merkle root for the allowlist                                                      |
| claimStart\_     | uint256 | The timestamp after which claims can occur                                         |
| claimEnd\_       | uint256 | The timestamp after which claims cannot occur, and remaining balance can be burned |

### onlyWhenClaimOpen

```solidity
modifier onlyWhenClaimOpen()
```

\_onlyWhenClaimOpen

This modifier will revert if the claim status is not OPEN\_

### onlyWhenClaimEnded

```solidity
modifier onlyWhenClaimEnded()
```

\_onlyWhenClaimEnded

This modifier will revert if the claim status is not ENDED\_

### getClaimPeriodStatusEnum

```solidity
function getClaimPeriodStatusEnum() public view returns (enum IDelegatedERC20ClaimWithBurn.ClaimPeriodStatus status_)
```

\_getClaimPeriodStatusEnum

Public function to return the current status of the claim as an ENUM.\_

#### Return Values

| Name     | Type                                                | Description                                              |
| -------- | --------------------------------------------------- | -------------------------------------------------------- |
| status\_ | enum IDelegatedERC20ClaimWithBurn.ClaimPeriodStatus | The current status as an Enum of type ClaimPeriodStatus. |

### getClaimPeriodStatus

```solidity
function getClaimPeriodStatus() external view returns (string status_)
```

\_getClaimPeriodStatus

External function to return the current status of the claim as a string.\_

#### Return Values

| Name     | Type   | Description                     |
| -------- | ------ | ------------------------------- |
| status\_ | string | The current status as a string. |

### claim

```solidity
function claim(address allowanceHolder_, uint256 allowanceAmount_, uint256 claimAmount_, bytes32[] proof_) external
```

\_claim

Validate caller eligiblity and claim ERC20\_

#### Parameters

| Name              | Type      | Description                                                                                                                                                                                                                         |
| ----------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| allowanceHolder\_ | address   | The address that holds an allowance. This need not be the caller, in the case where the caller is a delegate of the allowance holder. But they need to have an unclaimed allowance, i.e. initial allowance - claimed allowance > 0. |
| allowanceAmount\_ | uint256   | The initial allowance that this holder is entitled to.                                                                                                                                                                              |
| claimAmount\_     | uint256   | The amount that the user is claiming in this call.                                                                                                                                                                                  |
| proof\_           | bytes32[] | The calculated proof.                                                                                                                                                                                                               |

### checkMerkleTree

```solidity
function checkMerkleTree(bytes32[] proof_, address allowanceHolder_, uint256 allowanceAmount_, address caller_) public view
```

\_checkMerkleTree

A public method to check if a leaf hash and proof pass the merkle check. It will revert if it does not.\_

#### Parameters

| Name              | Type      | Description                                                                                                                                                                                                                         |
| ----------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------- |
| proof\_           | bytes32[] | The provided proof                                                                                                                                                                                                                  |
| allowanceHolder\_ | address   | The address that holds an allowance. This need not be the caller, in the case where the caller is a delegate of the allowance holder. But they need to have an unclaimed allowance, i.e. initial allowance - claimed allowance > 0. |
| allowanceAmount\_ | uint256   | The initial allowance that this holder is entitled to. Leaf format is allowanceHolder                                                                                                                                               | delegate | allowanceAmount |
| caller\_          | address   | The msg.sender on this txn.                                                                                                                                                                                                         |

### burnUnclaimed

```solidity
function burnUnclaimed() external
```

\_burnUnclaimed

Burn any unclaimed token. Can only be called after the claim has ended.

Note - token must be burnable.\_

### \_checkRemainingAllowance

```solidity
function _checkRemainingAllowance(address allowanceHolder_, uint256 allowanceAmount_, uint256 claimAmount_) internal view
```

\_\_checkRemainingAllowance

An internal method to check that the allowance holder will not receive more token than their
total allowance.\_

#### Parameters

| Name              | Type    | Description                                                                                                                                                                                                                         |
| ----------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| allowanceHolder\_ | address | The address that holds an allowance. This need not be the caller, in the case where the caller is a delegate of the allowance holder. But they need to have an unclaimed allowance, i.e. initial allowance - claimed allowance > 0. |
| allowanceAmount\_ | uint256 | The initial allowance that this holder is entitled to.                                                                                                                                                                              |
| claimAmount\_     | uint256 | The amount that the user is claiming in this call.                                                                                                                                                                                  |

### \_recordClaim

```solidity
function _recordClaim(address allowanceHolder_, uint256 allowanceClaimed_) internal
```

\_\_recordClaim

An internal method to recored that the allowance holder has made a claim.\_

#### Parameters

| Name               | Type    | Description                                           |
| ------------------ | ------- | ----------------------------------------------------- |
| allowanceHolder\_  | address | The address for which the allowance has been claimed. |
| allowanceClaimed\_ | uint256 | The amount of token that has been claimed.            |

### \_distributeClaim

```solidity
function _distributeClaim(address allowanceHolder_, uint256 allowanceClaimed_) internal
```

\_\_distributeClaim

An internal method to transfer ERC20 to the allowance holder.\_

#### Parameters

| Name               | Type    | Description                                           |
| ------------------ | ------- | ----------------------------------------------------- |
| allowanceHolder\_  | address | The address for which the allowance has been claimed. |
| allowanceClaimed\_ | uint256 | The amount of token that has been claimed.            |

## IDelegatedERC20ClaimWithBurn

### ClaimPeriodStatus

```solidity
enum ClaimPeriodStatus {
  Before,
  Open,
  Ended
}
```

### AllowanceClaimed

```solidity
event AllowanceClaimed(address allowanceHolder, uint256 allowanceClaimed)
```

### UnclaimedAllowanceBurned

```solidity
event UnclaimedAllowanceBurned(uint256 burnedBalance)
```

### getClaimPeriodStatusEnum

```solidity
function getClaimPeriodStatusEnum() external view returns (enum IDelegatedERC20ClaimWithBurn.ClaimPeriodStatus status_)
```

\_getClaimPeriodStatusEnum

Public function to return the current status of the claim as an ENUM.\_

#### Return Values

| Name     | Type                                                | Description                                              |
| -------- | --------------------------------------------------- | -------------------------------------------------------- |
| status\_ | enum IDelegatedERC20ClaimWithBurn.ClaimPeriodStatus | The current status as an Enum of type ClaimPeriodStatus. |

### getClaimPeriodStatus

```solidity
function getClaimPeriodStatus() external view returns (string status_)
```

\_getClaimPeriodStatus

External function to return the current status of the claim as a string.\_

#### Return Values

| Name     | Type   | Description                     |
| -------- | ------ | ------------------------------- |
| status\_ | string | The current status as a string. |

### claim

```solidity
function claim(address allowanceHolder_, uint256 allowanceAmount_, uint256 claimAmount_, bytes32[] proof_) external
```

\_claim

Validate caller eligiblity and claim ERC20\_

#### Parameters

| Name              | Type      | Description                                                                                                                                                                                                                         |
| ----------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| allowanceHolder\_ | address   | The address that holds an allowance. This need not be the caller, in the case where the caller is a delegate of the allowance holder. But they need to have an unclaimed allowance, i.e. initial allowance - claimed allowance > 0. |
| allowanceAmount\_ | uint256   | The initial allowance that this holder is entitled to.                                                                                                                                                                              |
| claimAmount\_     | uint256   | The amount that the user is claiming in this call.                                                                                                                                                                                  |
| proof\_           | bytes32[] | The calculated proof.                                                                                                                                                                                                               |

### checkMerkleTree

```solidity
function checkMerkleTree(bytes32[] proof_, address allowanceHolder_, uint256 allowanceAmount_, address caller_) external view
```

\_checkMerkleTree

A public method to check if a leaf hash and proof pass the merkle check. It will revert if it does not.\_

#### Parameters

| Name              | Type      | Description                                                                                                                                                                                                                         |
| ----------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------- |
| proof\_           | bytes32[] | The provided proof                                                                                                                                                                                                                  |
| allowanceHolder\_ | address   | The address that holds an allowance. This need not be the caller, in the case where the caller is a delegate of the allowance holder. But they need to have an unclaimed allowance, i.e. initial allowance - claimed allowance > 0. |
| allowanceAmount\_ | uint256   | The initial allowance that this holder is entitled to. Leaf format is allowanceHolder                                                                                                                                               | delegate | allowanceAmount |
| caller\_          | address   | The msg.sender on this txn.                                                                                                                                                                                                         |

### burnUnclaimed

```solidity
function burnUnclaimed() external
```

\_burnUnclaimed

Burn any unclaimed token. Can only be called after the claim has ended.

Note - token must be burnable.\_

## IERC20Burnable

### burn

```solidity
function burn(uint256 amount) external
```

\_Destroys `amount` tokens from the caller.

See {ERC20-_burn}._

### burnFrom

```solidity
function burnFrom(address account, uint256 amount) external
```

\_Destroys `amount` tokens from `account`, deducting from the caller's
allowance.

See {ERC20-\_burn} and {ERC20-allowance}.

Requirements:

- the caller must have allowance for `accounts`'s tokens of at least
  `amount`.\_
