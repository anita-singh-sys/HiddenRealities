import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:address", "Prints the EncryptedSecrets address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const encryptedSecrets = await deployments.get("EncryptedSecrets");

  console.log("EncryptedSecrets address is " + encryptedSecrets.address);
});

task("task:secret-count", "Prints the number of secrets stored for a user")
  .addParam("owner", "Address to inspect")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const encryptedSecretsDeployment = await deployments.get("EncryptedSecrets");
    const contract = await ethers.getContractAt("EncryptedSecrets", encryptedSecretsDeployment.address);

    const count = await contract.getSecretCount(taskArguments.owner);
    console.log(`Secrets stored for ${taskArguments.owner}: ${count.toString()}`);
  });

task("task:get-secret", "Reads a secret entry for an owner and index")
  .addParam("owner", "Address that owns the secret")
  .addParam("index", "Secret index to fetch")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const encryptedSecretsDeployment = await deployments.get("EncryptedSecrets");
    const contract = await ethers.getContractAt("EncryptedSecrets", encryptedSecretsDeployment.address);

    const index = BigInt(taskArguments.index);
    const secret = await contract.getSecret(taskArguments.owner, index);
    console.log(`Ciphertext (hex): ${secret[0]}`);
    console.log(`IV (hex): ${secret[1]}`);
    console.log(`Encrypted password handle: ${secret[2]}`);
    console.log(`Created at: ${secret[3].toString()}`);
    console.log(`Label: ${secret[4]}`);
  });
