# delegated-erc20-claim-with-burn

Abstract contract for claiming an ERC20 allowance, both as the allowance holder and as an authorised delegate.

Note - in ALL cases the allowance goes to the allowance holder. A delegate is merely authorised to submit a claim
transaction (useful when allowlists addresses are in the deep freeze).
