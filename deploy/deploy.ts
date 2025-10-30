import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedEncryptedSecrets = await deploy("EncryptedSecrets", {
    from: deployer,
    log: true,
  });

  console.log(`EncryptedSecrets contract: `, deployedEncryptedSecrets.address);
};
export default func;
func.id = "deploy_encryptedSecrets"; // id required to prevent reexecution
func.tags = ["EncryptedSecrets"];
