const { ethers } = require("hardhat")
const { expect } = require("chai")
const { MerkleTree } = require("merkletreejs")

describe("DelegatedClaim", function () {
  let owner
  let holder1
  let holder2
  let holder3
  let holder4
  let delegate1
  let delegate2

  let hhMockERC20
  let hhClaim

  const startDelay = 60
  const window = 60

  let root
  let tree
  let leaves
  let start
  let end

  function createLeafHash(allowanceHolder, delegate, allowanceAmount) {
    const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint256"],
      [allowanceHolder.address, delegate.address, allowanceAmount],
    )

    return ethers.keccak256(encodedData)
  }

  before(async function () {
    ;[
      owner,
      holder1,
      holder2,
      holder3,
      holder4,
      delegate1,
      delegate2,
      ...addrs
    ] = await ethers.getSigners()

    leaves = [
      // holder1, no delegate, claiming from own address:
      createLeafHash(holder1, holder1, 100000),
      // holder2, can only be claimed by delegate1
      createLeafHash(holder2, delegate1, 200000),
      // holder 3, can be claimed by own address or delegate2
      createLeafHash(holder3, holder3, 300000),
      createLeafHash(holder3, delegate2, 300000),
      // Holder 4, unlucky late claimer....
      createLeafHash(holder4, holder4, 400000),
    ]

    tree = new MerkleTree(leaves, ethers.keccak256, { sort: true })

    root = tree.getHexRoot()

    const now = Number((await ethers.provider.getBlock("latest")).timestamp)

    start = now + startDelay
    end = start + window

    const mockERC20 = await ethers.getContractFactory("MockERC20")
    hhMockERC20 = await mockERC20.deploy()

    const claim = await ethers.getContractFactory("DelegatedERC20ClaimWithBurn")
    hhClaim = await claim.deploy(hhMockERC20.target, root, start, end)

    await hhMockERC20
      .connect(owner)
      .transfer(hhClaim.target, BigInt(21000000) * BigInt(10 ** 18))
  })

  context("Deployment checks", function () {
    before(async function () {})

    it("Root is set", async () => {
      expect(await hhClaim.merkleRoot()).to.equal(root)
    })

    it("Start time is set", async () => {
      expect(await hhClaim.claimStart()).to.equal(start)
    })

    it("End time is set", async () => {
      expect(await hhClaim.claimEnd()).to.equal(end)
    })

    it("Total supply", async () => {
      expect(await hhMockERC20.totalSupply()).to.equal(
        BigInt(21000000) * BigInt(10 ** 18),
      )
    })

    it("All supply held by token", async () => {
      expect(await hhMockERC20.balanceOf(hhClaim.target)).to.equal(
        BigInt(21000000) * BigInt(10 ** 18),
      )
    })

    it("Status ENUM is before", async () => {
      expect(await hhClaim.getClaimPeriodStatusEnum()).to.equal(0)
    })

    it("Status string is before", async () => {
      expect(await hhClaim.getClaimPeriodStatus()).to.equal("before")
    })
  })

  context("Before window is open", function () {
    before(async function () {})

    it("Cannot claim with correct details", async () => {
      const leaf = leaves[0]
      const proof = tree.getHexProof(leaf)

      await expect(
        hhClaim.connect(holder1).claim(holder1.address, 100000, 100000, proof),
      ).to.be.revertedWith("Claim is not open")
    })

    it("Cannot claim with incorrect details", async () => {
      const leaf = leaves[0]
      const proof = tree.getHexProof(leaf)

      await expect(
        hhClaim
          .connect(delegate1)
          .claim(holder1.address, 100000, 100000, proof),
      ).to.be.revertedWith("Claim is not open")
    })

    it("Cannot claim with incorrect details", async () => {
      const leaf = leaves[0]
      const proof = tree.getHexProof(leaf)

      await expect(
        hhClaim.connect(holder1).claim(holder1.address, 100001, 100001, proof),
      ).to.be.revertedWith("Claim is not open")
    })

    it("Cannot burn remainder", async () => {
      await expect(hhClaim.connect(holder1).burnUnclaimed()).to.be.revertedWith(
        "Claim is not yet ended",
      )
    })
  })

  context("During window", function () {
    before(async function () {
      // Move to when the claim is open:
      await ethers.provider.send("evm_setNextBlockTimestamp", [start + 1])
      await ethers.provider.send("evm_mine", [])
    })

    it("Status ENUM is open", async () => {
      expect(await hhClaim.getClaimPeriodStatusEnum()).to.equal(1)
    })

    it("Status string is open", async () => {
      expect(await hhClaim.getClaimPeriodStatus()).to.equal("open")
    })

    describe("Burning remainder", function () {
      it("Cannot burn remainder", async () => {
        await expect(
          hhClaim.connect(holder1).burnUnclaimed(),
        ).to.be.revertedWith("Claim is not yet ended")
      })
    })

    describe("Claiming by allowance holder only", function () {
      it("Claim by holder only: Cannot claim with incorrect caller", async () => {
        const leaf = leaves[0]
        const proof = tree.getHexProof(leaf)

        await expect(
          hhClaim
            .connect(delegate1)
            .claim(holder1.address, 1000000, 1000000, proof),
        ).to.be.revertedWith("Invalid claim details")
      })

      it("Claim by holder only: Cannot claim with incorrect allowance amount", async () => {
        const leaf = leaves[0]
        const proof = tree.getHexProof(leaf)

        await expect(
          hhClaim
            .connect(holder1)
            .claim(holder1.address, 1000001, 1000000, proof),
        ).to.be.revertedWith("Invalid claim details")
      })

      it("Claim by holder only: Can claim with correct details", async () => {
        const leaf = leaves[0]
        const proof = tree.getHexProof(leaf)

        await expect(
          hhClaim
            .connect(holder1)
            .claim(holder1.address, 100000, 100000, proof),
        ).not.be.reverted
      })

      it("Claim by holder only: ERC20 held balance has decreased", async () => {
        expect(await hhMockERC20.balanceOf(hhClaim.target)).to.equal(
          BigInt(21000000) * BigInt(10 ** 18) - BigInt(100000),
        )
      })

      it("Claim by holder only: holder held balance has increase", async () => {
        expect(await hhMockERC20.balanceOf(holder1.address)).to.equal(
          BigInt(100000),
        )
      })

      it("Claim by holder only: holder claimed balance has increase", async () => {
        expect(await hhClaim.claimedAmount(holder1.address)).to.equal(
          BigInt(100000),
        )
      })

      it("Claim by holder only: Cannot claim twice", async () => {
        const leaf = leaves[0]
        const proof = tree.getHexProof(leaf)

        await expect(
          hhClaim.connect(holder1).claim(holder1.address, 100000, 1, proof),
        ).to.be.revertedWith("Claim exceeds allowance")
      })
    })

    describe("Claiming by delegate only", function () {
      it("Claim by holder only: Cannot claim with incorrect caller", async () => {
        const leaf = leaves[1]
        const proof = tree.getHexProof(leaf)

        await expect(
          hhClaim
            .connect(holder2)
            .claim(holder2.address, 2000000, 2000000, proof),
        ).to.be.revertedWith("Invalid claim details")
      })

      it("Claim by delegate only: Cannot claim with incorrect allowance amount", async () => {
        const leaf = leaves[1]
        const proof = tree.getHexProof(leaf)

        await expect(
          hhClaim
            .connect(delegate1)
            .claim(holder2.address, 2000001, 2000000, proof),
        ).to.be.revertedWith("Invalid claim details")
      })

      it("Claim by delegate only: Can claim with correct details", async () => {
        const leaf = leaves[1]
        const proof = tree.getHexProof(leaf)

        await expect(
          hhClaim
            .connect(delegate1)
            .claim(holder2.address, 200000, 200000, proof),
        ).not.be.reverted
      })

      it("Claim by delegate only: ERC20 held balance has decreased", async () => {
        expect(await hhMockERC20.balanceOf(hhClaim.target)).to.equal(
          BigInt(21000000) * BigInt(10 ** 18) - BigInt(100000) - BigInt(200000),
        )
      })

      it("Claim by delegate only: holder held balance has increased", async () => {
        expect(await hhMockERC20.balanceOf(holder2.address)).to.equal(
          BigInt(200000),
        )
      })

      it("Claim by delegate only: delegate held balance has not increased", async () => {
        expect(await hhMockERC20.balanceOf(delegate1.address)).to.equal(
          BigInt(0),
        )
      })

      it("Claim by delegate only: holder claimed balance has increase", async () => {
        expect(await hhClaim.claimedAmount(holder2.address)).to.equal(
          BigInt(200000),
        )
      })

      it("Claim by delegate only: delegate claimed balance has not increase", async () => {
        expect(await hhClaim.claimedAmount(delegate1.address)).to.equal(
          BigInt(0),
        )
      })

      it("Claim by delegate only: Cannot claim twice", async () => {
        const leaf = leaves[1]
        const proof = tree.getHexProof(leaf)

        await expect(
          hhClaim.connect(delegate1).claim(holder2.address, 200000, 1, proof),
        ).to.be.revertedWith("Claim exceeds allowance")
      })
    })

    describe("Claiming by holder or delegate", function () {
      it("Claim by holder or delegate: Cannot claim with incorrect caller", async () => {
        const leaf = leaves[2]
        const proof = tree.getHexProof(leaf)

        await expect(
          hhClaim
            .connect(delegate1)
            .claim(holder3.address, 3000000, 3000000, proof),
        ).to.be.revertedWith("Invalid claim details")
      })

      it("Claim by holder or delegate: Cannot claim with incorrect allowance amount", async () => {
        const leaf = leaves[2]
        const proof = tree.getHexProof(leaf)

        await expect(
          hhClaim
            .connect(holder3)
            .claim(holder3.address, 3000001, 3000000, proof),
        ).to.be.revertedWith("Invalid claim details")

        const leaf2 = leaves[3]
        const proof2 = tree.getHexProof(leaf2)

        await expect(
          hhClaim
            .connect(delegate2)
            .claim(holder3.address, 3000001, 3000000, proof2),
        ).to.be.revertedWith("Invalid claim details")
      })

      it("Claim by holder or delegate: Can claim PARTIAL with correct details", async () => {
        const leaf = leaves[2]
        const proof = tree.getHexProof(leaf)

        await expect(
          hhClaim
            .connect(holder3)
            .claim(holder3.address, 300000, 150000, proof),
        ).not.be.reverted
      })

      it("Claim by holder or delegate: ERC20 held balance has decreased", async () => {
        expect(await hhMockERC20.balanceOf(hhClaim.target)).to.equal(
          BigInt(21000000) * BigInt(10 ** 18) -
            BigInt(100000) -
            BigInt(200000) -
            BigInt(150000),
        )
      })

      it("Claim by holder or delegate: holder held balance has increased", async () => {
        expect(await hhMockERC20.balanceOf(holder3.address)).to.equal(
          BigInt(150000),
        )
      })

      it("Claim by holder or delegate: holder claimed balance has increase", async () => {
        expect(await hhClaim.claimedAmount(holder3.address)).to.equal(
          BigInt(150000),
        )
      })

      it("Claim by holder or delegate: Can claim with correct details", async () => {
        const leaf = leaves[3]
        const proof = tree.getHexProof(leaf)

        await expect(
          hhClaim
            .connect(delegate2)
            .claim(holder3.address, 300000, 150000, proof),
        ).not.be.reverted
      })

      it("Claim by holder or delegate: ERC20 held balance has decreased", async () => {
        expect(await hhMockERC20.balanceOf(hhClaim.target)).to.equal(
          BigInt(21000000) * BigInt(10 ** 18) -
            BigInt(100000) -
            BigInt(200000) -
            BigInt(150000) -
            BigInt(150000),
        )
      })

      it("Claim by holder or delegate: holder held balance has increased", async () => {
        expect(await hhMockERC20.balanceOf(holder3.address)).to.equal(
          BigInt(300000),
        )
      })

      it("Claim by holder or delegate: delegate held balance has not increased", async () => {
        expect(await hhMockERC20.balanceOf(delegate2.address)).to.equal(
          BigInt(0),
        )
      })

      it("Claim by holder or delegate: holder claimed balance has increase", async () => {
        expect(await hhClaim.claimedAmount(holder3.address)).to.equal(
          BigInt(300000),
        )
      })

      it("Claim by holder or delegate: delegate claimed balance has not increase", async () => {
        expect(await hhClaim.claimedAmount(delegate2.address)).to.equal(
          BigInt(0),
        )
      })

      it("Claim by holder or delegate: Cannot claim over allowance", async () => {
        const leaf = leaves[2]
        const proof = tree.getHexProof(leaf)

        await expect(
          hhClaim.connect(holder3).claim(holder3.address, 300000, 1, proof),
        ).to.be.revertedWith("Claim exceeds allowance")

        const leaf2 = leaves[3]
        const proof2 = tree.getHexProof(leaf2)

        await expect(
          hhClaim.connect(delegate2).claim(holder3.address, 300000, 1, proof),
        ).to.be.revertedWith("Claim exceeds allowance")
      })
    })
  })

  context("After window is closed", function () {
    before(async function () {
      // Move to when the claim is open:
      await ethers.provider.send("evm_setNextBlockTimestamp", [end])
      await ethers.provider.send("evm_mine", [])
    })

    it("Status ENUM is after", async () => {
      expect(await hhClaim.getClaimPeriodStatusEnum()).to.equal(2)
    })

    it("Status string is open", async () => {
      expect(await hhClaim.getClaimPeriodStatus()).to.equal("ended")
    })

    it("Cannot claim with correct details", async () => {
      const leaf = leaves[4]
      const proof = tree.getHexProof(leaf)

      await expect(
        hhClaim.connect(holder4).claim(holder4.address, 400000, 400000, proof),
      ).to.be.revertedWith("Claim is not open")
    })

    it("Can burn remainder", async () => {
      await expect(hhClaim.connect(holder1).burnUnclaimed()).to.not.be.reverted
    })

    it("All supply held by claim contract is burned", async () => {
      expect(await hhMockERC20.balanceOf(hhClaim.target)).to.equal(BigInt(0))
    })

    it("Total supply of ERC20 reduced", async () => {
      expect(await hhMockERC20.totalSupply()).to.equal(BigInt(600000))
    })

    it("Holder balances remain", async () => {
      expect(await hhClaim.claimedAmount(holder1.address)).to.equal(
        BigInt(100000),
      )
      expect(await hhClaim.claimedAmount(holder2.address)).to.equal(
        BigInt(200000),
      )
      expect(await hhClaim.claimedAmount(holder3.address)).to.equal(
        BigInt(300000),
      )
    })
  })
})
