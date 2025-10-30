import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { EncryptedSecrets, EncryptedSecrets__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("EncryptedSecrets")) as EncryptedSecrets__factory;
  const encryptedSecretsContract = (await factory.deploy()) as EncryptedSecrets;
  const encryptedSecretsContractAddress = await encryptedSecretsContract.getAddress();

  return { encryptedSecretsContract, encryptedSecretsContractAddress };
}

describe("EncryptedSecrets", function () {
  let signers: Signers;
  let encryptedSecretsContract: EncryptedSecrets;
  let encryptedSecretsContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ encryptedSecretsContract, encryptedSecretsContractAddress } = await deployFixture());
  });

  async function encryptAddress(forUser: HardhatEthersSigner, addressToEncrypt: string) {
    const normalized = ethers.getAddress(addressToEncrypt);
    const encryptedInput = await fhevm
      .createEncryptedInput(encryptedSecretsContractAddress, forUser.address)
      .addAddress(normalized)
      .encrypt();
    return encryptedInput;
  }

  it("stores a new secret and retrieves it", async function () {
    const label = "My message";
    const ciphertext = ethers.getBytes(ethers.hexlify(ethers.toUtf8Bytes("ciphertext")));
    const iv = ethers.getBytes("0x0102030405060708090a0b0c");

    const passwordAddress = ethers.getAddress("0x00000000000000000000000000000000000000aa");
    const encryptedPassword = await encryptAddress(signers.alice, passwordAddress);

    const tx = await encryptedSecretsContract
      .connect(signers.alice)
      .storeSecret(encryptedPassword.handles[0], encryptedPassword.inputProof, ciphertext, iv, label);
    await tx.wait();

    const count = await encryptedSecretsContract.getSecretCount(signers.alice.address);
    expect(count).to.eq(1n);

    const stored = await encryptedSecretsContract.getSecret(signers.alice.address, 0n);
    expect(stored[0]).to.eq(ethers.hexlify(ciphertext));
    expect(stored[1]).to.eq(ethers.hexlify(iv));
    expect(stored[4]).to.eq(label);
    expect(stored[3]).to.be.gt(0n);
    expect(stored[2]).to.not.eq(ethers.ZeroHash);
  });

  it("reverts for an invalid index", async function () {
    await expect(encryptedSecretsContract.getSecret(signers.alice.address, 0n)).to.be.revertedWith("Invalid secret index");
  });

  it("isolates secrets per account", async function () {
    const encryptedPasswordAlice = await encryptAddress(
      signers.alice,
      ethers.getAddress("0x00000000000000000000000000000000000000a1"),
    );
    const encryptedPasswordBob = await encryptAddress(
      signers.bob,
      ethers.getAddress("0x00000000000000000000000000000000000000b1"),
    );

    const ciphertext = ethers.getBytes("0x1122");
    const iv = ethers.getBytes("0xaabbccddeeff001122334455");

    await encryptedSecretsContract
      .connect(signers.alice)
      .storeSecret(encryptedPasswordAlice.handles[0], encryptedPasswordAlice.inputProof, ciphertext, iv, "Alice secret");
    await encryptedSecretsContract
      .connect(signers.bob)
      .storeSecret(encryptedPasswordBob.handles[0], encryptedPasswordBob.inputProof, ciphertext, iv, "Bob secret");

    const countAlice = await encryptedSecretsContract.getSecretCount(signers.alice.address);
    const countBob = await encryptedSecretsContract.getSecretCount(signers.bob.address);

    expect(countAlice).to.eq(1n);
    expect(countBob).to.eq(1n);

    const secretAlice = await encryptedSecretsContract.getSecret(signers.alice.address, 0n);
    expect(secretAlice[4]).to.eq("Alice secret");
    const secretBob = await encryptedSecretsContract.getSecret(signers.bob.address, 0n);
    expect(secretBob[4]).to.eq("Bob secret");
  });
});
