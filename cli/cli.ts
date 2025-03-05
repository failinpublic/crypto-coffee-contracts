import * as anchor from "@coral-xyz/anchor";
import { web3, BN } from "@coral-xyz/anchor";
import { Command } from "commander";

const programId = new web3.PublicKey("3ujQg6Cqf5XycaPGRbEqZkTwRQSDmE8ThKfZXhCMy5o9");

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const cryptoCoffee = anchor.workspace.CryptoCoffee

function getPlatformStatePda(): [web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
        [Buffer.from("platform_state")],
        programId
    );
}

function getCreatorDiscountPda(creator: web3.PublicKey): [web3.PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
        [Buffer.from("creator_fee_discount"), creator.toBuffer()],
        programId
    );
}

const programCLI = new Command();

programCLI
    .name("crypto-coffee-cli")
    .description("CLI tool to interact with the Crypto Coffee smart contract using choral-xyz/anchor")
    .version("0.1.0");

//
// Command: update-fee-destination
//
programCLI
    .command("update-fee-destination <newFeeDestination>")
    .description("Update the fee destination account")
    .action(async (newFeeDestination: string) => {
        try {
            const [platformStatePda] = getPlatformStatePda();
            const newFeeDestPubKey = new web3.PublicKey(newFeeDestination);

            const tx = await cryptoCoffee.rpc.updateFeeDestination({
                accounts: {
                    platformState: platformStatePda,
                    authority: provider.wallet.publicKey,
                    newFeeDestination: newFeeDestPubKey,
                },
            });
            console.log("Fee destination updated. Transaction signature:", tx);
        } catch (error) {
            console.error("Error updating fee destination:", error);
        }
    });

//
// Command: update-fee
//
programCLI
    .command("update-fee <newFeePercentage>")
    .description("Update the platform fee percentage (0-100)")
    .action(async (newFeePercentage: string) => {
        try {
            const feePercentage = new BN(newFeePercentage);
            const [platformStatePda] = getPlatformStatePda();

            const tx = await cryptoCoffee.rpc.updateFee(feePercentage, {
                accounts: {
                    platformState: platformStatePda,
                    authority: provider.wallet.publicKey,
                },
            });
            console.log("Fee percentage updated. Transaction signature:", tx);
        } catch (error) {
            console.error("Error updating fee percentage:", error);
        }
    });

//
// Command: add-creator-discount
//
programCLI
    .command("add-creator-discount <creator> <feePercentage>")
    .description("Add a creator fee discount (0-100) for a given creator")
    .action(async (creator: string, feePercentage: string) => {
        try {
            const creatorPubKey = new web3.PublicKey(creator);
            const discountFee = new BN(feePercentage);
            const [platformStatePda] = getPlatformStatePda();
            const [creatorDiscountPda] = getCreatorDiscountPda(creatorPubKey);

            const tx = await cryptoCoffee.rpc.addCreatorFeeDiscount(discountFee, {
                accounts: {
                    creatorDiscount: creatorDiscountPda,
                    platformState: platformStatePda,
                    creator: creatorPubKey,
                    authority: provider.wallet.publicKey,
                    systemProgram: web3.SystemProgram.programId,
                },
            });
            console.log("Creator discount added. Transaction signature:", tx);
        } catch (error) {
            console.error("Error adding creator discount:", error);
        }
    });

//
// Command: update-creator-discount
//
programCLI
    .command("update-creator-discount <creator> <newFeePercentage>")
    .description("Update an existing creator fee discount (0-100)")
    .action(async (creator: string, newFeePercentage: string) => {
        try {
            const creatorPubKey = new web3.PublicKey(creator);
            const discountFee = new BN(newFeePercentage);
            const [platformStatePda] = getPlatformStatePda();
            const [creatorDiscountPda] = getCreatorDiscountPda(creatorPubKey);

            const tx = await cryptoCoffee.rpc.updateCreatorFeeDiscount(discountFee, {
                accounts: {
                    creatorDiscount: creatorDiscountPda,
                    platformState: platformStatePda,
                    creator: creatorPubKey,
                    authority: provider.wallet.publicKey,
                },
            });
            console.log("Creator discount updated. Transaction signature:", tx);
        } catch (error) {
            console.error("Error updating creator discount:", error);
        }
    });

//
// Command: remove-creator-discount
//
programCLI
    .command("remove-creator-discount <creator>")
    .description("Remove the creator fee discount for a given creator")
    .action(async (creator: string) => {
        try {
            const creatorPubKey = new web3.PublicKey(creator);
            const [platformStatePda] = getPlatformStatePda();
            const [creatorDiscountPda] = getCreatorDiscountPda(creatorPubKey);

            const tx = await cryptoCoffee.rpc.removeCreatorDiscount({
                accounts: {
                    creatorDiscount: creatorDiscountPda,
                    creator: creatorPubKey,
                    authority: provider.wallet.publicKey,
                    platformState: platformStatePda,
                },
            });
            console.log("Creator discount removed. Transaction signature:", tx);
        } catch (error) {
            console.error("Error removing creator discount:", error);
        }
    });

programCLI.parse(process.argv);
