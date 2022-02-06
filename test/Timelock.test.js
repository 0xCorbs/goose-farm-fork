const { expectRevert, time } = require("@openzeppelin/test-helpers");
const ethers = require("ethers");
const Token = artifacts.require("Token");
const MasterChef = artifacts.require("MasterChef");
const MockERC20 = artifacts.require("MockERC20");
const Timelock = artifacts.require("Timelock");

function encodeParameters(types, values) {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values);
}

contract("Timelock", ([alice, bob, carol, dev, minter]) => {
  beforeEach(async () => {
    this.token = await Token.new({ from: alice });
    this.timelock = await Timelock.new(bob, "21600", { from: alice });
  });

  it("should not allow non-owner to do operation", async () => {
    await this.token.transferOwnership(this.timelock.address, { from: alice });
    await expectRevert(
      this.token.transferOwnership(carol, { from: alice }),
      "Ownable: caller is not the owner"
    );
    await expectRevert(
      this.token.transferOwnership(carol, { from: bob }),
      "Ownable: caller is not the owner"
    );
    await expectRevert(
      this.timelock.queueTransaction(
        this.token.address,
        "0",
        "transferOwnership(address)",
        encodeParameters(["address"], [carol]),
        (await time.latest()).add(time.duration.days(4)),
        { from: alice }
      ),
      "Timelock::queueTransaction: Call must come from admin."
    );
  });

  it("should do the timelock thing", async () => {
    await this.token.transferOwnership(this.timelock.address, { from: alice });
    const eta = (await time.latest()).add(time.duration.days(4));
    await this.timelock.queueTransaction(
      this.token.address,
      "0",
      "transferOwnership(address)",
      encodeParameters(["address"], [carol]),
      eta,
      { from: bob }
    );
    await time.increase(time.duration.days(1));
    await expectRevert(
      this.timelock.executeTransaction(
        this.token.address,
        "0",
        "transferOwnership(address)",
        encodeParameters(["address"], [carol]),
        eta,
        { from: bob }
      ),
      "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
    );
    await time.increase(time.duration.days(4));
    await this.timelock.executeTransaction(
      this.token.address,
      "0",
      "transferOwnership(address)",
      encodeParameters(["address"], [carol]),
      eta,
      { from: bob }
    );
    assert.equal((await this.token.owner()).valueOf(), carol);
  });

  it("should also work with MasterChef", async () => {
    this.lp1 = await MockERC20.new("LPToken", "LP", "18", "10000000000", {
      from: minter,
    });
    this.lp2 = await MockERC20.new("LPToken", "LP", "18", "10000000000", {
      from: minter,
    });
    this.chef = await MasterChef.new(
      this.token.address,
      dev,
      dev,
      "100",
      "999999999",
      { from: alice }
    );
    await this.token.transferOwnership(this.chef.address, { from: alice });
    await this.chef.add("100", this.lp1.address, "0", true);
    await this.chef.transferOwnership(this.timelock.address, { from: alice });
    const eta = (await time.latest()).add(time.duration.days(4));
    console.log(eta.toString());
    console.log(Math.floor(Date.now() / 1000) + 345600);
    // setstartblock
    await this.timelock.queueTransaction(
      this.chef.address,
      "0",
      "setStartBlock(uint256)",
      encodeParameters(["uint256"], [123456]),
      eta,
      { from: bob }
    );
    //------end-----
    await this.timelock.queueTransaction(
      this.chef.address,
      "0",
      "set(uint256,uint256,uint16,bool)",
      encodeParameters(
        ["uint256", "uint256", "uint16", "bool"],
        ["0", "200", "0", false]
      ),
      eta,
      { from: bob }
    );
    await this.timelock.queueTransaction(
      this.chef.address,
      "0",
      "add(uint256,address,uint16,bool)",
      encodeParameters(
        ["uint256", "address", "uint16", "bool"],
        ["100", this.lp2.address, "0", false]
      ),
      eta,
      { from: bob }
    );
    await time.increase(time.duration.days(4));
    // setstartblock
    await this.timelock.executeTransaction(
      this.chef.address,
      "0",
      "setStartBlock(uint256)",
      encodeParameters(["uint256"], [123456]),
      eta,
      { from: bob }
    );
    //------end-----
    await this.timelock.executeTransaction(
      this.chef.address,
      "0",
      "set(uint256,uint256,uint16,bool)",
      encodeParameters(
        ["uint256", "uint256", "uint16", "bool"],
        ["0", "200", "0", false]
      ),
      eta,
      { from: bob }
    );
    await this.timelock.executeTransaction(
      this.chef.address,
      "0",
      "add(uint256,address,uint16,bool)",
      encodeParameters(
        ["uint256", "address", "uint16", "bool"],
        ["100", this.lp2.address, "0", false]
      ),
      eta,
      { from: bob }
    );
    assert.equal((await this.chef.poolInfo("0")).valueOf().allocPoint, "200");
    assert.equal((await this.chef.totalAllocPoint()).valueOf(), "300");
    assert.equal((await this.chef.poolLength()).valueOf(), "2");
    assert.equal((await this.chef.startBlock()).valueOf(), "123456");
  });
});
