const anchor = require("@coral-xyz/anchor");

module.exports = async function (provider) {
  // Configure client to use the provider.
  anchor.setProvider(provider);

  // Retrieve the deployed program from the workspace.
  const program = anchor.workspace.CryptoCoffee;
  const authority = provider.wallet;
  // Generate a fee destination keypair; you can also replace this with a known public key if desired.
  const feeDestination = anchor.web3.Keypair.generate();

  // Derive the PDA for the platform state using the seed "platform_state".
  const [platformStatePda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("platform_state")],
      program.programId
  );

  console.log("Deploying program and initializing platform...");

  try {
    // Call the initializePlatform method with a fee percentage of 5.
    const tx = await program.methods
        .initializePlatform(new anchor.BN(5))
        .accounts({
          authority: authority.publicKey,
          feeDestination: feeDestination.publicKey,
          platformState: platformStatePda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

    console.log("Platform initialized at:", platformStatePda.toString());
    console.log("Transaction signature:", tx);
  } catch (err) {
    console.error("Error during platform initialization:", err);
  }
};