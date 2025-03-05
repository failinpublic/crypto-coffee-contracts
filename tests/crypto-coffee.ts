import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CryptoCoffee } from "../target/types/crypto_coffee";
import { PublicKey } from "@solana/web3.js";
import { expect, assert } from "chai";

describe("crypto-coffee", () => {
    // Common provider and program setup.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.CryptoCoffee as Program<CryptoCoffee>;

    // ---------------------------------------------------------------
    // Initialization tests
    // ---------------------------------------------------------------
    describe("initialise", () => {
        const authority = provider.wallet;
        const feeDestination = anchor.web3.Keypair.generate();

        // Derive platform state PDA.
        const [platformStatePda] = PublicKey.findProgramAddressSync(
            [Buffer.from("platform_state")],
            program.programId
        );

        it("Fails to initialize with invalid fee percentage", async () => {
            const invalidFeePercentage = 101;
            try {
                await program.methods
                    .initializePlatform(new anchor.BN(invalidFeePercentage))
                    .accounts({
                        authority: authority.publicKey,
                        feeDestination: feeDestination.publicKey,
                    })
                    .rpc();
                assert.fail("Should have thrown an error for invalid fee percentage");
            } catch (err: any) {
                expect(err.error.errorCode.code).to.equal("InvalidFeePercentage");
            }
        });

        it("Successfully initializes with valid fee percentage", async () => {
            const platformFeePercentage = 10;
            const tx = await program.methods
                .initializePlatform(new anchor.BN(platformFeePercentage))
                .accounts({
                    authority: authority.publicKey,
                    feeDestination: feeDestination.publicKey,
                })
                .rpc();

            const platformState = await program.account.platformState.fetch(
                platformStatePda
            );
            expect(platformState.authority.toString()).to.equal(
                authority.publicKey.toString()
            );
            expect(platformState.feeDestination.toString()).to.equal(
                feeDestination.publicKey.toString()
            );
            expect(platformState.feePercentage.toNumber()).to.equal(
                platformFeePercentage
            );
        });

        it("Prevents double initialization", async () => {
            const platformFeePercentage = 10;
            try {
                await program.methods
                    .initializePlatform(new anchor.BN(platformFeePercentage))
                    .accounts({
                        authority: authority.publicKey,
                        feeDestination: feeDestination.publicKey,
                    })
                    .rpc();
                assert.fail("Expected transaction to fail with already initialized error");
            } catch (err: any) {
                const logs = err.logs;
                expect(logs.some((log: string) => log.includes("already in use"))).to.be
                    .true;
            }
        });
    });

    // ---------------------------------------------------------------
    // Update fee tests
    // ---------------------------------------------------------------
    describe("update fee", () => {
        const authority = provider.wallet;
        const feeDestination = anchor.web3.Keypair.generate();
        const unauthorized = anchor.web3.Keypair.generate();

        const [platformStatePda] = PublicKey.findProgramAddressSync(
            [Buffer.from("platform_state")],
            program.programId
        );

        // Initialize the platform before running update tests.
        before(async () => {
            try {
                await program.methods
                    .initializePlatform(new anchor.BN(10))
                    .accounts({
                        authority: authority.publicKey,
                        feeDestination: feeDestination.publicKey,
                    })
                    .rpc();
            } catch (error: any) {
                if (!error.logs?.some((log: string) => log.includes("already in use"))) {
                    throw error;
                }
            }
        });

        it("Successfully updates fee percentage", async () => {
            const newFeePercentage = 15;
            await program.methods
                .updateFee(new anchor.BN(newFeePercentage))
                .accounts({
                    platformState: platformStatePda,
                    authority: authority.publicKey,
                })
                .rpc();

            const platformState = await program.account.platformState.fetch(
                platformStatePda
            );
            expect(platformState.feePercentage.toNumber()).to.equal(newFeePercentage);
        });

        it("Fails to update with invalid fee percentage", async () => {
            const invalidFeePercentage = 101;
            try {
                await program.methods
                    .updateFee(new anchor.BN(invalidFeePercentage))
                    .accounts({
                        platformState: platformStatePda,
                        authority: authority.publicKey,
                    })
                    .rpc();
                assert.fail("Should have thrown an error for invalid fee percentage");
            } catch (err: any) {
                expect(err.error.errorCode.code).to.equal("InvalidFeePercentage");
            }
        });

        it("Prevents unauthorized fee updates", async () => {
            try {
                const airdropSignature = await provider.connection.requestAirdrop(
                    unauthorized.publicKey,
                    anchor.web3.LAMPORTS_PER_SOL
                );
                await provider.connection.confirmTransaction(airdropSignature);

                await program.methods
                    .updateFee(new anchor.BN(20))
                    .accounts({
                        platformState: platformStatePda,
                        authority: unauthorized.publicKey,
                    })
                    .signers([unauthorized])
                    .rpc();
                assert.fail("Should have thrown an unauthorized error");
            } catch (err: any) {
                expect(err.error.errorCode.code).to.equal("Unauthorized");
            }
        });
    });

    // ---------------------------------------------------------------
    // Update fee destination tests
    // ---------------------------------------------------------------
    describe("update fee destination", () => {
        const authority = provider.wallet;
        const initialFeeDestination = anchor.web3.Keypair.generate();
        const newFeeDestination = anchor.web3.Keypair.generate();
        const unauthorized = anchor.web3.Keypair.generate();

        const [platformStatePda] = PublicKey.findProgramAddressSync(
            [Buffer.from("platform_state")],
            program.programId
        );

        // Initialize the platform before running update tests.
        before(async () => {
            try {
                await program.methods
                    .initializePlatform(new anchor.BN(10))
                    .accounts({
                        authority: authority.publicKey,
                        feeDestination: initialFeeDestination.publicKey,
                    })
                    .rpc();
            } catch (error: any) {
                if (!error.logs?.some((log: string) => log.includes("already in use"))) {
                    throw error;
                }
            }
        });

        it("Successfully updates fee destination", async () => {
            await program.methods
                .updateFeeDestination()
                .accounts({
                    authority: authority.publicKey,
                    newFeeDestination: newFeeDestination.publicKey,
                })
                .rpc();

            const platformState = await program.account.platformState.fetch(
                platformStatePda
            );
            expect(platformState.feeDestination.toString()).to.equal(
                newFeeDestination.publicKey.toString()
            );
        });

        it("Prevents unauthorized fee destination updates", async () => {
            try {
                const airdropSignature = await provider.connection.requestAirdrop(
                    unauthorized.publicKey,
                    anchor.web3.LAMPORTS_PER_SOL
                );
                await provider.connection.confirmTransaction(airdropSignature);

                await program.methods
                    .updateFeeDestination()
                    .accounts({
                        authority: unauthorized.publicKey,
                        newFeeDestination: newFeeDestination.publicKey,
                    })
                    .signers([unauthorized])
                    .rpc();
                assert.fail("Should have thrown an unauthorized error");
            } catch (err: any) {
                expect(err.error.errorCode.code).to.equal("Unauthorized");
            }
        });

        it("Can update fee destination multiple times", async () => {
            const anotherFeeDestination = anchor.web3.Keypair.generate();

            await program.methods
                .updateFeeDestination()
                .accounts({
                    authority: authority.publicKey,
                    newFeeDestination: anotherFeeDestination.publicKey,
                })
                .rpc();

            const platformState = await program.account.platformState.fetch(
                platformStatePda
            );
            expect(platformState.feeDestination.toString()).to.equal(
                anotherFeeDestination.publicKey.toString()
            );
        });
    });

    // ---------------------------------------------------------------
    // Buy coffee tests (without discount)
    // ---------------------------------------------------------------
    describe("buy coffee", () => {
        const authority = provider.wallet;
        const feeDestination = anchor.web3.Keypair.generate();
        const creator = anchor.web3.Keypair.generate();
        const contributor = anchor.web3.Keypair.generate();

        const [platformStatePda] = PublicKey.findProgramAddressSync(
            [Buffer.from("platform_state")],
            program.programId
        );

        before(async () => {
            // Airdrop to contributor, creator, fee destination.
            const airdropAccounts = [
                contributor.publicKey,
                creator.publicKey,
                feeDestination.publicKey,
            ];
            for (const key of airdropAccounts) {
                const sig = await provider.connection.requestAirdrop(
                    key,
                    5 * anchor.web3.LAMPORTS_PER_SOL
                );
                await provider.connection.confirmTransaction(sig);
            }

            try {
                await program.methods
                    .initializePlatform(new anchor.BN(10))
                    .accounts({
                        authority: authority.publicKey,
                        feeDestination: feeDestination.publicKey,
                    })
                    .rpc();
            } catch (error: any) {
                if (!error.logs?.some((log: string) => log.includes("already in use"))) {
                    throw error;
                }
            }
        });

        it("Successfully processes payment with proper fee splitting", async () => {
            const platformState = await program.account.platformState.fetch(
                platformStatePda
            );
            const feePercentage = platformState.feePercentage.toNumber();

            // Additional airdrops for creator and fee destination.
            await provider.connection.confirmTransaction(
                await provider.connection.requestAirdrop(
                    creator.publicKey,
                    anchor.web3.LAMPORTS_PER_SOL
                )
            );
            await provider.connection.confirmTransaction(
                await provider.connection.requestAirdrop(
                    platformState.feeDestination,
                    anchor.web3.LAMPORTS_PER_SOL
                )
            );

            const initialContributorBalance = await provider.connection.getBalance(
                contributor.publicKey
            );
            const initialCreatorBalance = await provider.connection.getBalance(
                creator.publicKey
            );
            const initialFeeDestBalance = await provider.connection.getBalance(
                platformState.feeDestination
            );

            const unitPrice = new anchor.BN(1_000_000);
            const units = new anchor.BN(5);
            const totalAmount = unitPrice.toNumber() * units.toNumber();
            const expectedFeeAmount = Math.floor((totalAmount * feePercentage) / 100);
            const expectedCreatorAmount = totalAmount - expectedFeeAmount;

            await program.methods
                .buyCoffee(units, unitPrice)
                .accounts({
                    platformState: platformStatePda,
                    contributor: contributor.publicKey,
                    creator: creator.publicKey,
                    feeDestination: platformState.feeDestination,
                    creatorFeeDiscount: null,
                })
                .signers([contributor])
                .rpc();

            const finalContributorBalance = await provider.connection.getBalance(
                contributor.publicKey
            );
            const finalCreatorBalance = await provider.connection.getBalance(
                creator.publicKey
            );
            const finalFeeDestBalance = await provider.connection.getBalance(
                platformState.feeDestination
            );

            const contributorChange =
                initialContributorBalance - finalContributorBalance;
            const creatorChange = finalCreatorBalance - initialCreatorBalance;
            const feeDestChange = finalFeeDestBalance - initialFeeDestBalance;

            expect(contributorChange).to.equal(totalAmount);
            expect(creatorChange).to.equal(expectedCreatorAmount);
            expect(feeDestChange).to.equal(expectedFeeAmount);
        });

        it("Fails when unit price is 0", async () => {
            const platformState = await program.account.platformState.fetch(
                platformStatePda
            );
            const unitPrice = new anchor.BN(0);
            const units = new anchor.BN(1);
            try {
                await program.methods
                    .buyCoffee(units, unitPrice)
                    .accounts({
                        platformState: platformStatePda,
                        contributor: contributor.publicKey,
                        creator: creator.publicKey,
                        feeDestination: platformState.feeDestination,
                        creatorFeeDiscount: null,
                    })
                    .signers([contributor])
                    .rpc();
                assert.fail("Should have thrown invalid unit price error");
            } catch (err: any) {
                expect(err.error.errorCode.code).to.equal("InvalidUnitPrice");
            }
        });

        it("Fails when units is 0", async () => {
            const platformState = await program.account.platformState.fetch(
                platformStatePda
            );
            const unitPrice = new anchor.BN(1_000_000);
            const units = new anchor.BN(0);
            try {
                await program.methods
                    .buyCoffee(units, unitPrice)
                    .accounts({
                        platformState: platformStatePda,
                        contributor: contributor.publicKey,
                        creator: creator.publicKey,
                        feeDestination: platformState.feeDestination,
                        creatorFeeDiscount: null,
                    })
                    .signers([contributor])
                    .rpc();
                assert.fail("Should have thrown invalid units error");
            } catch (err: any) {
                expect(err.error.errorCode.code).to.equal("InvalidUnits");
            }
        });

        it("Fails when contributor has insufficient funds", async () => {
            const platformState = await program.account.platformState.fetch(
                platformStatePda
            );
            const poorContributor = anchor.web3.Keypair.generate();
            const unitPrice = new anchor.BN(1_000_000_000);
            const units = new anchor.BN(1);
            try {
                await program.methods
                    .buyCoffee(units, unitPrice)
                    .accounts({
                        platformState: platformStatePda,
                        contributor: poorContributor.publicKey,
                        creator: creator.publicKey,
                        feeDestination: platformState.feeDestination,
                        creatorFeeDiscount: null,
                    })
                    .signers([poorContributor])
                    .rpc();
                assert.fail("Should have thrown insufficient funds error");
            } catch (err: any) {
                expect(err.logs.some((log: string) => log.includes("insufficient lamports"))).to.be.true;
            }
        });

        it("Processes payment with different fee percentages correctly", async () => {
            const platformState = await program.account.platformState.fetch(
                platformStatePda
            );
            await program.methods
                .updateFee(new anchor.BN(20))
                .accounts({
                    platformState: platformStatePda,
                    authority: authority.publicKey,
                })
                .rpc();

            const initialContributorBalance = await provider.connection.getBalance(
                contributor.publicKey
            );
            const initialCreatorBalance = await provider.connection.getBalance(
                creator.publicKey
            );
            const initialFeeDestBalance = await provider.connection.getBalance(
                platformState.feeDestination
            );

            const unitPrice = new anchor.BN(1_000_000);
            const units = new anchor.BN(10);
            const totalAmount = unitPrice.toNumber() * units.toNumber();
            const expectedFeeAmount = Math.floor(totalAmount * 0.2);
            const expectedCreatorAmount = totalAmount - expectedFeeAmount;

            await program.methods
                .buyCoffee(units, unitPrice)
                .accounts({
                    platformState: platformStatePda,
                    contributor: contributor.publicKey,
                    creator: creator.publicKey,
                    feeDestination: platformState.feeDestination,
                    creatorFeeDiscount: null,
                })
                .signers([contributor])
                .rpc();

            const finalContributorBalance = await provider.connection.getBalance(
                contributor.publicKey
            );
            const finalCreatorBalance = await provider.connection.getBalance(
                creator.publicKey
            );
            const finalFeeDestBalance = await provider.connection.getBalance(
                platformState.feeDestination
            );

            const contributorChange =
                initialContributorBalance - finalContributorBalance;
            expect(contributorChange).to.equal(totalAmount);
            expect(finalCreatorBalance - initialCreatorBalance).to.equal(expectedCreatorAmount);
            expect(finalFeeDestBalance - initialFeeDestBalance).to.equal(expectedFeeAmount);
        });
    });

    // ---------------------------------------------------------------
    // Buy coffee with zero fee tests
    // ---------------------------------------------------------------
    describe("buy coffee with zero fees", () => {
        const authority = provider.wallet;
        const feeDestination = anchor.web3.Keypair.generate();
        const creator = anchor.web3.Keypair.generate();
        const contributor = anchor.web3.Keypair.generate();
        const [platformStatePda] = PublicKey.findProgramAddressSync(
            [Buffer.from("platform_state")],
            program.programId
        );

        before(async () => {
            await provider.connection.requestAirdrop(
                contributor.publicKey,
                5 * anchor.web3.LAMPORTS_PER_SOL
            );
            await provider.connection.requestAirdrop(
                creator.publicKey,
                2 * anchor.web3.LAMPORTS_PER_SOL
            );
            await provider.connection.requestAirdrop(
                feeDestination.publicKey,
                2 * anchor.web3.LAMPORTS_PER_SOL
            );
            try {
                await program.methods
                    .initializePlatform(new anchor.BN(10))
                    .accounts({
                        authority: authority.publicKey,
                        feeDestination: feeDestination.publicKey,
                    })
                    .rpc();
            } catch (err) {
                console.log("Platform already initialized, updating fee destination...");
                await program.methods
                    .updateFeeDestination()
                    .accounts({
                        authority: authority.publicKey,
                        newFeeDestination: feeDestination.publicKey,
                    })
                    .rpc();
            }
            await program.methods
                .updateFee(new anchor.BN(0))
                .accounts({
                    platformState: platformStatePda,
                    authority: authority.publicKey,
                })
                .rpc();
        });

        it("Processes payment correctly when fee is 0%", async () => {
            const platformState = await program.account.platformState.fetch(
                platformStatePda
            );
            expect(platformState.feePercentage.toNumber()).to.equal(0);

            const initialContributorBalance = await provider.connection.getBalance(
                contributor.publicKey
            );
            const initialCreatorBalance = await provider.connection.getBalance(
                creator.publicKey
            );
            const initialFeeDestBalance = await provider.connection.getBalance(
                feeDestination.publicKey
            );

            const unitPrice = new anchor.BN(1_000_000);
            const units = new anchor.BN(5);
            const totalAmount = unitPrice.toNumber() * units.toNumber();
            const expectedFeeAmount = 0;
            const expectedCreatorAmount = totalAmount;

            await program.methods
                .buyCoffee(units, unitPrice)
                .accounts({
                    platformState: platformStatePda,
                    contributor: contributor.publicKey,
                    creator: creator.publicKey,
                    feeDestination: feeDestination.publicKey,
                    creatorFeeDiscount: null,
                })
                .signers([contributor])
                .rpc();

            const finalContributorBalance = await provider.connection.getBalance(
                contributor.publicKey
            );
            const finalCreatorBalance = await provider.connection.getBalance(
                creator.publicKey
            );
            const finalFeeDestBalance = await provider.connection.getBalance(
                feeDestination.publicKey
            );

            const contributorChange =
                initialContributorBalance - finalContributorBalance;
            const creatorChange = finalCreatorBalance - initialCreatorBalance;
            const feeDestChange = finalFeeDestBalance - initialFeeDestBalance;

            expect(contributorChange).to.equal(totalAmount);
            expect(creatorChange).to.equal(expectedCreatorAmount);
            expect(feeDestChange).to.equal(expectedFeeAmount);
        });
    });

    // ---------------------------------------------------------------
    // Creator fee discount tests
    // ---------------------------------------------------------------
    describe("creator fee discount tests", () => {
        const authority = provider.wallet;
        const creator = anchor.web3.Keypair.generate();
        const contributor = anchor.web3.Keypair.generate();
        const feeDestination = anchor.web3.Keypair.generate();

        const [platformStatePda] = PublicKey.findProgramAddressSync(
            [Buffer.from("platform_state")],
            program.programId
        );

        let discountPda: PublicKey;

        before(async () => {
            const airdropAccounts = [
                contributor.publicKey,
                creator.publicKey,
                feeDestination.publicKey,
            ];
            for (const key of airdropAccounts) {
                const sig = await provider.connection.requestAirdrop(
                    key,
                    5 * anchor.web3.LAMPORTS_PER_SOL
                );
                await provider.connection.confirmTransaction(sig);
            }
            try {
                await program.methods
                    .initializePlatform(new anchor.BN(10))
                    .accounts({
                        authority: authority.publicKey,
                        feeDestination: feeDestination.publicKey,
                    })
                    .rpc();
            } catch (err) {
                console.log("Platform already initialized; updating fee destination...");
                await program.methods
                    .updateFeeDestination()
                    .accounts({
                        authority: authority.publicKey,
                        newFeeDestination: feeDestination.publicKey,
                    })
                    .rpc();
            }
        });

        it("should add a creator discount", async () => {
            const discountFee = 5; // e.g., 5% fee discount
            const [discountPdaComputed] = PublicKey.findProgramAddressSync(
                [Buffer.from("creator_fee_discount"), creator.publicKey.toBuffer()],
                program.programId
            );
            discountPda = discountPdaComputed;

            await program.methods
                .addCreatorFeeDiscount(new anchor.BN(discountFee))
                .accounts({
                    creatorDiscount: discountPda,
                    platformState: platformStatePda,
                    creator: creator.publicKey,
                    authority: authority.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            const discountAccount = await program.account.creatorFeeDiscount.fetch(
                discountPda
            );
            expect(discountAccount.creator.toString()).to.equal(
                creator.publicKey.toString()
            );
            expect(discountAccount.feePercentage.toNumber()).to.equal(discountFee);
        });

        it("should update a creator discount", async () => {
            const newDiscountFee = 3; // change discount to 3%
            await program.methods
                .updateCreatorFeeDiscount(new anchor.BN(newDiscountFee))
                .accounts({
                    creatorDiscount: discountPda,
                    platformState: platformStatePda,
                    creator: creator.publicKey,
                    authority: authority.publicKey,
                })
                .rpc();

            const discountAccount = await program.account.creatorFeeDiscount.fetch(
                discountPda
            );
            expect(discountAccount.feePercentage.toNumber()).to.equal(newDiscountFee);
        });

        it("should remove a creator discount", async () => {
            await program.methods
                .removeCreatorDiscount()
                .accounts({
                    creatorDiscount: discountPda,
                    creator: creator.publicKey,
                    authority: authority.publicKey,
                    platformState: platformStatePda,
                })
                .rpc();

            try {
                await program.account.creatorFeeDiscount.fetch(discountPda);
                assert.fail("Expected discount account to be removed");
            } catch (err: any) {
                const errMsg = err.toString();
                expect(errMsg).to.match(/does not exist/i);
            }
        });

        it("should process payment using creator discount", async () => {
            // Re-add a discount for this test (e.g., 2% fee discount)
            const discountFee = 2;
            const [discountPdaComputed] = PublicKey.findProgramAddressSync(
                [Buffer.from("creator_fee_discount"), creator.publicKey.toBuffer()],
                program.programId
            );
            discountPda = discountPdaComputed;

            await program.methods
                .addCreatorFeeDiscount(new anchor.BN(discountFee))
                .accounts({
                    creatorDiscount: discountPda,
                    platformState: platformStatePda,
                    creator: creator.publicKey,
                    authority: authority.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            const platformStateAccount = await program.account.platformState.fetch(
                platformStatePda
            );
            const initialContributorBalance = await provider.connection.getBalance(
                contributor.publicKey
            );
            const initialCreatorBalance = await provider.connection.getBalance(
                creator.publicKey
            );
            const initialFeeDestBalance = await provider.connection.getBalance(
                platformStateAccount.feeDestination
            );

            const unitPrice = new anchor.BN(1_000_000);
            const units = new anchor.BN(5);
            const totalAmount = unitPrice.toNumber() * units.toNumber();
            const expectedFeeAmount = Math.floor((totalAmount * discountFee) / 100);
            const expectedCreatorAmount = totalAmount - expectedFeeAmount;

            await program.methods
                .buyCoffee(units, unitPrice)
                .accounts({
                    platformState: platformStatePda,
                    contributor: contributor.publicKey,
                    creator: creator.publicKey,
                    feeDestination: platformStateAccount.feeDestination,
                    creatorFeeDiscount: discountPda,
                })
                .signers([contributor])
                .rpc();

            const finalContributorBalance = await provider.connection.getBalance(
                contributor.publicKey
            );
            const finalCreatorBalance = await provider.connection.getBalance(
                creator.publicKey
            );
            const finalFeeDestBalance = await provider.connection.getBalance(
                platformStateAccount.feeDestination
            );

            const contributorChange =
                initialContributorBalance - finalContributorBalance;
            const creatorChange = finalCreatorBalance - initialCreatorBalance;
            const feeDestChange = finalFeeDestBalance - initialFeeDestBalance;

            expect(contributorChange).to.equal(totalAmount);
            expect(creatorChange).to.equal(expectedCreatorAmount);
            expect(feeDestChange).to.equal(expectedFeeAmount);
        });
    });
});
