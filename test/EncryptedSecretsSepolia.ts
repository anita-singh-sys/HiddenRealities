import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployments, ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { EncryptedSecrets } from "../types";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("EncryptedSecretsSepolia", function () {
  let signers: Signers;
  let encryptedSecretsContract: EncryptedSecrets;
  let encryptedSecretsContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const deployment = await deployments.get("EncryptedSecrets");
      encryptedSecretsContractAddress = deployment.address;
      encryptedSecretsContract = await ethers.getContractAt("EncryptedSecrets", deployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("stores a secret on Sepolia", async function () {
    steps = 6;
    this.timeout(4 * 40000);

    progress("Encrypting password address for Alice...");
    const encryptedPassword = await fhevm
      .createEncryptedInput(encryptedSecretsContractAddress, signers.alice.address)
      .addAddress(signers.alice.address)
      .encrypt();

    const ciphertext = ethers.getBytes(ethers.hexlify(ethers.randomBytes(32)));
    const iv = ethers.getBytes(ethers.hexlify(ethers.randomBytes(12)));

    progress("Submitting storeSecret transaction...");
    const tx = await encryptedSecretsContract
      .connect(signers.alice)
      .storeSecret(encryptedPassword.handles[0], encryptedPassword.inputProof, ciphertext, iv, "Sepolia run");
    await tx.wait();

    progress("Reading owner secret count...");
    const count = await encryptedSecretsContract.getSecretCount(signers.alice.address);
    expect(count).to.be.greaterThan(0n);

    progress("Fetching stored secret...");
    const secret = await encryptedSecretsContract.getSecret(signers.alice.address, count - 1n);
    expect(secret[0]).to.not.eq("0x");
    expect(secret[1]).to.not.eq("0x");
    expect(secret[4]).to.eq("Sepolia run");

    progress("Completed Sepolia secret storage test.");
  });
});
