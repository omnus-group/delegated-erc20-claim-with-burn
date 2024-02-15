// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20Burnable, ERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract MockERC20 is ERC20Burnable {
  constructor() ERC20("MyToken", "MTK") {
    _mint(msg.sender, 21000000 * 10 ** decimals());
  }
}
