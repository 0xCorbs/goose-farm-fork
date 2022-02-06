const { expectRevert, time } = require("@openzeppelin/test-helpers");
const Token = artifacts.require("Token");
const MasterChef = artifacts.require("MasterChef");
const MockERC20 = artifacts.require("MockERC20");

contract("MasterChef", ([alice, bob, carol, dev, minter]) => {
  beforeEach(async () => {
    this.token = await Token.new({ from: alice });
  });

  it("should set correct state variables", async () => {
    this.chef = await MasterChef.new(
      this.token.address,
      dev,
      dev,
      "1000",
      "0",
      { from: alice }
    );
    await this.token.transferOwnership(this.chef.address, { from: alice });
    const token = await this.chef.token();
    const devaddr = await this.chef.devaddr();
    const owner = await this.token.owner();
    assert.equal(token.valueOf(), this.token.address);
    assert.equal(devaddr.valueOf(), dev);
    assert.equal(owner.valueOf(), this.chef.address);
  });

  it("should allow dev and only dev to update dev", async () => {
    this.chef = await MasterChef.new(
      this.token.address,
      dev,
      dev,
      "1000",
      "0",
      { from: alice }
    );
    assert.equal((await this.chef.devaddr()).valueOf(), dev);
    await expectRevert(this.chef.dev(bob, { from: bob }), "dev: wut?");
    await this.chef.dev(bob, { from: dev });
    assert.equal((await this.chef.devaddr()).valueOf(), bob);
    await this.chef.dev(alice, { from: bob });
    assert.equal((await this.chef.devaddr()).valueOf(), alice);
  });

  context("With ERC/LP token added to the field", () => {
    beforeEach(async () => {
      this.lp = await MockERC20.new("LPToken", "LP", "18", "10000000000", {
        from: minter,
      });
      await this.lp.transfer(alice, "1000", { from: minter });
      await this.lp.transfer(bob, "1000", { from: minter });
      await this.lp.transfer(carol, "1000", { from: minter });
      this.lp2 = await MockERC20.new("LPToken2", "LP2", "18", "10000000000", {
        from: minter,
      });
      await this.lp2.transfer(alice, "1000", { from: minter });
      await this.lp2.transfer(bob, "1000", { from: minter });
      await this.lp2.transfer(carol, "1000", { from: minter });
    });

    it("should allow emergency withdraw", async () => {
      // 100 per block farming rate starting at block 100
      this.chef = await MasterChef.new(
        this.token.address,
        dev,
        dev,
        "100",
        "100",
        { from: alice }
      );
      await this.chef.add("100", this.lp.address, "0", true);
      await this.lp.approve(this.chef.address, "1000", { from: bob });
      await this.chef.deposit(0, "100", { from: bob });
      assert.equal((await this.lp.balanceOf(bob)).valueOf(), "900");
      await this.chef.emergencyWithdraw(0, { from: bob });
      assert.equal((await this.lp.balanceOf(bob)).valueOf(), "1000");
    });

    it("should give out TOKENs only after farming time", async () => {
      // 100 per block farming rate starting at block 100
      this.chef = await MasterChef.new(
        this.token.address,
        dev,
        dev,
        "100",
        "100",
        { from: alice }
      );
      await this.token.transferOwnership(this.chef.address, { from: alice });
      await this.chef.add("100", this.lp.address, "0", true);
      await this.lp.approve(this.chef.address, "1000", { from: bob });
      await this.chef.deposit(0, "100", { from: bob });
      await time.advanceBlockTo("89");
      await this.chef.deposit(0, "0", { from: bob }); // block 90
      assert.equal((await this.token.balanceOf(bob)).valueOf(), "0");
      await time.advanceBlockTo("94");
      await this.chef.deposit(0, "0", { from: bob }); // block 95
      assert.equal((await this.token.balanceOf(bob)).valueOf(), "0");
      await time.advanceBlockTo("99");
      await this.chef.deposit(0, "0", { from: bob }); // block 100
      assert.equal((await this.token.balanceOf(bob)).valueOf(), "0");
      await time.advanceBlockTo("100");
      await this.chef.deposit(0, "0", { from: bob }); // block 101
      assert.equal((await this.token.balanceOf(bob)).valueOf(), "95");
      await time.advanceBlockTo("104");
      await this.chef.deposit(0, "0", { from: bob }); // block 105
      // 500 * 0.95 (burnt) = 475
      assert.equal((await this.token.balanceOf(bob)).valueOf(), "475");
      // rewards/10 --> 500/10 = 50
      assert.equal((await this.token.balanceOf(dev)).valueOf(), "50");
      // total = 500 + 50 = 550
      assert.equal((await this.token.totalSupply()).valueOf(), "550");
    });

    it("should not distribute TOKENs if no one deposit", async () => {
      // 100 per block farming rate starting at block 200
      this.chef = await MasterChef.new(
        this.token.address,
        dev,
        dev,
        "100",
        "200",
        { from: alice }
      );
      await this.token.transferOwnership(this.chef.address, { from: alice });
      await this.chef.add("100", this.lp.address, "0", true);
      await this.lp.approve(this.chef.address, "1000", { from: bob });
      await time.advanceBlockTo("199");
      assert.equal((await this.token.totalSupply()).valueOf(), "0");
      await time.advanceBlockTo("204");
      assert.equal((await this.token.totalSupply()).valueOf(), "0");
      await time.advanceBlockTo("209");
      await this.chef.deposit(0, "10", { from: bob }); // block 210
      assert.equal((await this.token.totalSupply()).valueOf(), "0");
      assert.equal((await this.token.balanceOf(bob)).valueOf(), "0");
      assert.equal((await this.token.balanceOf(dev)).valueOf(), "0");
      assert.equal((await this.lp.balanceOf(bob)).valueOf(), "990");
      await time.advanceBlockTo("219");
      await this.chef.withdraw(0, "10", { from: bob }); // block 220
      // 100 * 10 (100 rewards per block * number of blocks) + 100 * 10 * 0.1 (burnt) = 1100
      assert.equal((await this.token.totalSupply()).valueOf(), "1100");
      // 100 tokens rewards per block = 100 * 0.1 * 10 = 100
      assert.equal((await this.token.balanceOf(dev)).valueOf(), "100");
      // 990 + 10 (withdrew lp) = 1000
      assert.equal((await this.lp.balanceOf(bob)).valueOf(), "1000");
    });

    it("should distribute TOKENs properly for each staker", async () => {
      // 100 per block farming rate starting at block 300
      this.chef = await MasterChef.new(
        this.token.address,
        dev,
        dev,
        "100",
        "300",
        { from: alice }
      );
      await this.token.transferOwnership(this.chef.address, { from: alice });
      await this.chef.add("100", this.lp.address, "0", true);
      await this.lp.approve(this.chef.address, "1000", { from: alice });
      await this.lp.approve(this.chef.address, "1000", { from: bob });
      await this.lp.approve(this.chef.address, "1000", { from: carol });
      // Alice deposits 10 LPs at block 310
      await time.advanceBlockTo("309");
      await this.chef.deposit(0, "10", { from: alice });
      // Bob deposits 20 LPs at block 314
      await time.advanceBlockTo("313");
      await this.chef.deposit(0, "20", { from: bob });
      // Carol deposits 30 LPs at block 318
      await time.advanceBlockTo("317");
      await this.chef.deposit(0, "30", { from: carol });
      // Alice deposits 10 more LPs at block 320. At this point:
      //   Alice should have: 4*100 + 4*1/3*100 + 2*1/6*100 = 566.6 * 0.95 = 538
      //   MasterChef should have the remaining: (1000 - 566) * 0.95 = 412
      await time.advanceBlockTo("319");
      await this.chef.deposit(0, "10", { from: alice });
      assert.equal((await this.token.totalSupply()).valueOf(), "1100");
      assert.equal((await this.token.balanceOf(alice)).valueOf(), "538");
      assert.equal((await this.token.balanceOf(bob)).valueOf(), "0");
      assert.equal((await this.token.balanceOf(carol)).valueOf(), "0");
      assert.equal(
        (await this.token.balanceOf(this.chef.address)).valueOf(),
        "412"
      );
      assert.equal((await this.token.balanceOf(dev)).valueOf(), "100");
      // Bob withdraws 5 LPs at block 330. At this point:
      //   Bob should have: (4*2/3*100 + 2*2/6*100 + 10*2/7*100) * 0.95 = 619 = 588
      await time.advanceBlockTo("329");
      await this.chef.withdraw(0, "5", { from: bob });
      assert.equal((await this.token.totalSupply()).valueOf(), "2200");
      assert.equal((await this.token.balanceOf(alice)).valueOf(), "538");
      assert.equal((await this.token.balanceOf(bob)).valueOf(), "588");
      assert.equal((await this.token.balanceOf(carol)).valueOf(), "0");
      assert.equal(
        (await this.token.balanceOf(this.chef.address)).valueOf(),
        "774"
      );
      assert.equal((await this.token.balanceOf(dev)).valueOf(), "200");
      // Alice withdraws 20 LPs at block 340.
      // Bob withdraws 15 LPs at block 350.
      // Carol withdraws 30 LPs at block 360.
      await time.advanceBlockTo("339");
      await this.chef.withdraw(0, "20", { from: alice });
      await time.advanceBlockTo("349");
      await this.chef.withdraw(0, "15", { from: bob });
      await time.advanceBlockTo("359");
      await this.chef.withdraw(0, "30", { from: carol });
      assert.equal((await this.token.totalSupply()).valueOf(), "5500");
      assert.equal((await this.token.balanceOf(dev)).valueOf(), "500");
      // Alice should have: 538 + (10*2/7*100 + 10*2/6.5*100) * 0.95 = 1102
      assert.equal((await this.token.balanceOf(alice)).valueOf(), "1102");
      // Bob should have: 588 + (10*1.5/6.5 * 100 + 10*1.5/4.5*100) * 0.95 = 1123
      assert.equal((await this.token.balanceOf(bob)).valueOf(), "1123");
      // Carol should have: (2*3/6*100 + 10*3/7*100 + 10*3/6.5*100 + 10*3/4.5*100 + 10*100) * 0.95 = 2524
      assert.equal((await this.token.balanceOf(carol)).valueOf(), "2524");
      // All of them should have 1000 LPs back.
      assert.equal((await this.lp.balanceOf(alice)).valueOf(), "1000");
      assert.equal((await this.lp.balanceOf(bob)).valueOf(), "1000");
      assert.equal((await this.lp.balanceOf(carol)).valueOf(), "1000");
    });

    it("should give proper TOKENs allocation to each pool", async () => {
      // 100 per block farming rate starting at block 400
      this.chef = await MasterChef.new(
        this.token.address,
        dev,
        dev,
        "100",
        "400",
        { from: alice }
      );
      await this.token.transferOwnership(this.chef.address, { from: alice });
      await this.lp.approve(this.chef.address, "1000", { from: alice });
      await this.lp2.approve(this.chef.address, "1000", { from: bob });
      // Add first LP to the pool with allocation 1
      await this.chef.add("10", this.lp.address, "0", true);
      // Alice deposits 10 LPs at block 410
      await time.advanceBlockTo("409");
      await this.chef.deposit(0, "10", { from: alice });
      // Add LP2 to the pool with allocation 2 at block 420
      await time.advanceBlockTo("419");
      await this.chef.add("20", this.lp2.address, "0", true);
      // Alice should have 10*100*0.95 pending reward
      assert.equal((await this.chef.pendingToken(0, alice)).valueOf(), "950");
      // Bob deposits 10 LP2s at block 425
      await time.advanceBlockTo("424");
      await this.chef.deposit(1, "5", { from: bob });
      // Alice should have 950 + (5*1/3*100)= 1116 pending reward
      assert.equal((await this.chef.pendingToken(0, alice)).valueOf(), "1116");
      await time.advanceBlockTo("430");
      // At block 430. Bob should get 5*2/3*100 = 333. Alice should get ~167 more.
      assert.equal((await this.chef.pendingToken(0, alice)).valueOf(), "1283");
      assert.equal((await this.chef.pendingToken(1, bob)).valueOf(), "333");
    });
  });
});
