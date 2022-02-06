const { expectRevert, time } = require("@openzeppelin/test-helpers");
const Token = artifacts.require("Token");
const Presale = artifacts.require("Presale");
const MockERC20 = artifacts.require("MockERC20");

contract("Presale", ([alice, bob, carol, dev, minter]) => {
  beforeEach(async () => {
    this.token = await Token.new({ from: minter });

    this.BUSD = await MockERC20.new(
      "BUSD",
      "BUSD",
      18,
      web3.utils.toWei("1000000000", "ether"),
      {
        from: minter,
      }
    );
    this.presale = await Presale.new(
      this.token.address,
      this.BUSD.address,
      // starts in 20 days
      Math.round((new Date().getTime() + 86400000 * 20) / 1000),
      { from: dev }
    );
  });

  it("Sale should be active after being deployed", async () => {
    assert.equal(await this.presale.isSaleActive(), true);
  });
  it("Should be able to setSaleActive to false", async () => {
    await this.presale.setSaleActive(false, { from: dev });
    assert.equal(await this.presale.isSaleActive(), false);
  });
  context("Buy tokens", () => {
    beforeEach(async () => {
      await this.token.mint(
        this.presale.address,
        web3.utils.toWei("100000", "ether"),
        {
          from: minter,
        }
      );
    });

    it("Should not be allowed to buy if it exceeds cap", async () => {
      await this.BUSD.transfer(alice, web3.utils.toWei("200001", "ether"), {
        from: minter,
      });
      await expectRevert(
        this.presale.buy(web3.utils.toWei("200001", "ether"), alice, {
          from: alice,
        }),
        "Presale hardcap reached"
      );
    });

    it("should not allow to buy when it's before starting time", async () => {
      // travel to 10 days later when buying starts
      await time.increase(86400 * 10);
      await this.BUSD.transfer(alice, web3.utils.toWei("200", "ether"), {
        from: minter,
      });
      await this.BUSD.approve(
        this.presale.address,
        web3.utils.toWei("2", "ether"),
        { from: alice }
      );
      await expectRevert(
        this.presale.buy(web3.utils.toWei("2", "ether"), alice, {
          from: alice,
        }),
        "Presale has not started"
      );
    });

    it("should not allow alice to buy when she has less than the amount she wants to buy", async () => {
      // travel to 11 days later when buying starts
      await time.increase(86400 * 11);
      await this.BUSD.transfer(alice, web3.utils.toWei("200", "ether"), {
        from: minter,
      });
      await expectRevert(
        this.presale.buy(web3.utils.toWei("201", "ether"), alice, {
          from: alice,
        }),
        "ERC20: transfer amount exceeds balance"
      );
    });

    it("Presale should operate well given the right conditions", async () => {
      await time.increase(86400 * 21);
      await this.BUSD.transfer(alice, web3.utils.toWei("200", "ether"), {
        from: minter,
      });
      await this.BUSD.transfer(bob, web3.utils.toWei("200", "ether"), {
        from: minter,
      });
      await this.BUSD.approve(
        this.presale.address,
        web3.utils.toWei("200", "ether"),
        { from: alice }
      );
      await this.BUSD.approve(
        this.presale.address,
        web3.utils.toWei("200", "ether"),
        { from: bob }
      );
      await this.presale.buy(web3.utils.toWei("200", "ether"), alice, {
        from: alice,
      });
      // presale balance after alice bought some tokens
      assert.equal(
        (await this.BUSD.balanceOf(this.presale.address)).valueOf(),
        web3.utils.toWei("200", "ether")
      );
      let a = await this.presale.tokensOwned(alice);
      assert.equal(
        (await this.presale.tokensOwned(alice)).valueOf(),
        web3.utils.toWei("200", "ether")
      );

      assert.equal(
        (await this.presale.tokensUnclaimed(alice)).valueOf(),
        web3.utils.toWei("200", "ether")
      );

      assert.equal(
        (await this.presale.totalTokensSold()).valueOf(),
        web3.utils.toWei("200", "ether")
      );

      assert.equal(
        (await this.presale.USDCReceived()).valueOf(),
        web3.utils.toWei("200", "ether")
      );

      //bob starts paying after alice
      await this.presale.buy(web3.utils.toWei("200", "ether"), bob, {
        from: bob,
      });
      // presale balance after alice bought some tokens
      assert.equal(
        (await this.BUSD.balanceOf(this.presale.address)).valueOf(),
        web3.utils.toWei("400", "ether")
      );

      assert.equal(
        (await this.presale.tokensOwned(bob)).valueOf(),
        web3.utils.toWei("200", "ether")
      );

      assert.equal(
        (await this.presale.tokensUnclaimed(bob)).valueOf(),
        web3.utils.toWei("200", "ether")
      );

      assert.equal(
        (await this.presale.totalTokensSold()).valueOf(),
        web3.utils.toWei("400", "ether")
      );

      assert.equal(
        (await this.presale.USDCReceived()).valueOf(),
        web3.utils.toWei("400", "ether")
      );
    });
  });

  context("Claim and withdraw tokens", async () => {
    beforeEach(async () => {
      await this.token.mint(
        this.presale.address,
        web3.utils.toWei("100000", "ether"),
        {
          from: minter,
        }
      );
      await time.increase(86400 * 21);
      await this.BUSD.transfer(alice, web3.utils.toWei("200", "ether"), {
        from: minter,
      });
      await this.BUSD.transfer(bob, web3.utils.toWei("200", "ether"), {
        from: minter,
      });
      await this.BUSD.approve(
        this.presale.address,
        web3.utils.toWei("200", "ether"),
        { from: alice }
      );
      await this.BUSD.approve(
        this.presale.address,
        web3.utils.toWei("200", "ether"),
        { from: bob }
      );
      await this.presale.buy(web3.utils.toWei("200", "ether"), alice, {
        from: alice,
      });

      await this.presale.buy(web3.utils.toWei("200", "ether"), bob, {
        from: bob,
      });
    });

    it("should not be able to claim when claim is not active", async () => {
      await expectRevert(
        this.presale.claimTokens(bob, { from: bob }),
        "Claim is not allowed yet"
      );
    });

    it("should not be able to claim when claim is not active", async () => {
      await expectRevert(
        this.presale.claimTokens(bob, { from: bob }),
        "Claim is not allowed yet"
      );
    });

    it("should not be able to claim when user doesn't own any token", async () => {
      await this.presale.setClaimActive(true, { from: dev });
      await expectRevert(
        this.presale.claimTokens(carol, { from: carol }),
        "User should own some TOKENs"
      );
    });
    it("should be able the claim tokens given the right conditions", async () => {
      await this.presale.setClaimActive(true, { from: dev });
      await this.presale.claimTokens(alice, { from: alice });
      await this.presale.claimTokens(bob, { from: bob });
      assert.equal(
        await this.token.balanceOf(alice).valueOf(),
        web3.utils.toWei("200", "ether")
      );
      assert.equal(
        await this.token.balanceOf(bob).valueOf(),
        web3.utils.toWei("200", "ether")
      );
      assert.equal(await this.presale.tokensUnclaimed(alice).valueOf(), "0");
      assert.equal(await this.presale.tokensUnclaimed(bob).valueOf(), "0");
    });

    it("should be able to withdraw funds", async () => {
      await this.presale.withdrawFunds({ from: dev });
      assert.equal(
        await this.BUSD.balanceOf(dev).valueOf(),
        web3.utils.toWei("400", "ether")
      );
    });

    it("should be able to withdraw unsold tkn", async () => {
      await this.presale.withdrawUnsoldTOKEN({ from: dev });
      let a = await this.token.balanceOf(dev);
      assert.equal(
        await this.token.balanceOf(dev).valueOf(),
        web3.utils.toWei("99600", "ether")
      );
    });
  });
});
