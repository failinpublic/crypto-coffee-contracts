const web3js= require("@solana/web3.js");
const anchor = require("@coral-xyz/anchor");

module.exports = async function (provider) {
  anchor.setProvider(provider);

  const program = anchor.workspace.CryptoCoffee;
  const authority = provider.wallet;

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
          feeDestination:  new web3js.PublicKey("CkLt9dfoyawMWLjidvjjFn3ro8kJrXcZ3p9Gvn7bXJk9"),
          platformState: platformStatePda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc({ commitment: "confirmed" });

    console.log("Platform initialized at:", platformStatePda.toString());
    console.log("Transaction signature:", tx);
  } catch (err) {
    console.error("Error during platform initialization:", err);
  }
};