// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title EncryptedSecrets
/// @notice Stores user secrets comprised of symmetric ciphertexts and encrypted passwords.
contract EncryptedSecrets is SepoliaConfig {
    struct Secret {
        eaddress password;
        bytes ciphertext;
        bytes iv;
        string label;
        uint256 createdAt;
    }

    mapping(address => Secret[]) private _secrets;

    event SecretStored(address indexed owner, uint256 indexed secretId, string label);

    /// @notice Store a new encrypted secret for the caller.
    /// @param encryptedPasswordExternal External encrypted password handle generated through the relayer.
    /// @param inputProof Proof produced by the relayer for the encrypted password.
    /// @param ciphertext Symmetric ciphertext bytes.
    /// @param iv Initialization vector used for symmetric encryption.
    /// @param label User provided label to help identify the secret.
    /// @return secretId Index of the stored secret for the caller.
    function storeSecret(
        externalEaddress encryptedPasswordExternal,
        bytes calldata inputProof,
        bytes calldata ciphertext,
        bytes calldata iv,
        string calldata label
    ) external returns (uint256 secretId) {
        require(ciphertext.length > 0, "Ciphertext required");
        require(iv.length > 0, "IV required");

        eaddress password = FHE.fromExternal(encryptedPasswordExternal, inputProof);

        FHE.allowThis(password);
        FHE.allow(password, msg.sender);

        Secret memory secret = Secret({
            password: password,
            ciphertext: ciphertext,
            iv: iv,
            label: label,
            createdAt: block.timestamp
        });

        _secrets[msg.sender].push(secret);
        secretId = _secrets[msg.sender].length - 1;

        emit SecretStored(msg.sender, secretId, label);
    }

    /// @notice Get how many secrets an account has stored.
    /// @param owner Account to inspect.
    /// @return The number of stored secrets for the account.
    function getSecretCount(address owner) external view returns (uint256) {
        return _secrets[owner].length;
    }

    /// @notice Retrieve a secret entry for an account.
    /// @param owner Account whose secret is fetched.
    /// @param index Position within the owner's secret list.
    /// @return ciphertext Stored symmetric ciphertext.
    /// @return iv Stored initialization vector.
    /// @return password Encrypted password protected by Zama FHE.
    /// @return createdAt Block timestamp when the secret was stored.
    /// @return label User supplied label.
    function getSecret(
        address owner,
        uint256 index
    )
        external
        view
        returns (bytes memory ciphertext, bytes memory iv, eaddress password, uint256 createdAt, string memory label)
    {
        require(index < _secrets[owner].length, "Invalid secret index");
        Secret storage secret = _secrets[owner][index];

        return (secret.ciphertext, secret.iv, secret.password, secret.createdAt, secret.label);
    }
}
