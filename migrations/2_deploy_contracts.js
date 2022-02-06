const Token = artifacts.require("Token.sol");
const MasterChef = artifacts.require("MasterChef.sol");
const Presale = artifacts.require("Presale.sol");

module.exports = async function (deployer, network, addresses) {
  if (network != "develop") {
    // -----------------------------------deploy masterchef-----------------------------------------------
    let dev = "";
    await deployer.deploy(Token, { from: dev });
    const token = await Token.deployed();
    console.log("token address is: ", token.address);
    await deployer.deploy(
      MasterChef,
      token.address,
      dev,
      dev,
      web3.utils.toWei("0.01", "ether"),
      "0"
    );
    const masterChef = await MasterChef.deployed();
    console.log(`masterChef address is : ${masterChef.address}`);
    // --------------------------------------------deploy presale---------------------------------
    await deployer.deploy(
      Presale,
      token.address,
      "", //USDC address
      Math.round(new Date(Date.now()).getTime() / 1000),
      { from: dev }
    );
    const presale = await Presale.deployed();
    console.log("presale address is: ", presale.address);
  }
};
