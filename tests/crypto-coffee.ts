import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CryptoCoffee } from "../target/types/crypto_coffee";
import { PublicKey } from '@solana/web3.js';
import { expect, assert } from 'chai';

describe("crypto-coffee", () => {
    // Common setup that runs before all test suites
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.CryptoCoffee as Program<CryptoCoffee>;

    describe("initialise", () => {
        // Test accounts for this suite
        const authority = provider.wallet;
        const feeDestination = anchor.web3.Keypair.generate();

        // Platform state PDA
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
                        feeDestination: feeDestination.publicKey
                    })
                    .rpc();

                assert.fail("Should have thrown an error for invalid fee percentage");
            } catch (err) {
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

            const platformState = await program.account.platformState.fetch(platformStatePda);
            expect(platformState.authority.toString()).to.equal(authority.publicKey.toString());
            expect(platformState.feeDestination.toString()).to.equal(feeDestination.publicKey.toString());
            expect(platformState.feePercentage.toNumber()).to.equal(platformFeePercentage);
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
            } catch (err) {
                const logs = err.logs;
                expect(logs.some(log => log.includes("already in use"))).to.be.true;
            }
        });
    });

    describe("update fee", () => {
        // Test accounts for this suite
        const authority = provider.wallet;
        const feeDestination = anchor.web3.Keypair.generate();
        const unauthorized = anchor.web3.Keypair.generate();

        // Platform state PDA
        const [platformStatePda] = PublicKey.findProgramAddressSync(
            [Buffer.from("platform_state")],
            program.programId
        );

        // Initialize the platform before running update tests
        before(async () => {
            try {
                await program.methods
                    .initializePlatform(new anchor.BN(10))
                    .accounts({
                        authority: authority.publicKey,
                        feeDestination: feeDestination.publicKey
                    })
                    .rpc();
            } catch (error) {
                // If initialization fails because account exists, that's okay
                if (!error.logs?.some(log => log.includes("already in use"))) {
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

            const platformState = await program.account.platformState.fetch(platformStatePda);
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
            } catch (err) {
                expect(err.error.errorCode.code).to.equal("InvalidFeePercentage");
            }
        });

        it("Prevents unauthorized fee updates", async () => {
            try {
                // First, airdrop some SOL to unauthorized user
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
            } catch (err) {
                expect(err.error.errorCode.code).to.equal("Unauthorized");
            }
        });
    });

    describe("update fee destination", () => {
        // Test accounts for this suite
        const authority = provider.wallet;
        const initialFeeDestination = anchor.web3.Keypair.generate();
        const newFeeDestination = anchor.web3.Keypair.generate();
        const unauthorized = anchor.web3.Keypair.generate();

        // Platform state PDA
        const [platformStatePda] = PublicKey.findProgramAddressSync(
            [Buffer.from("platform_state")],
            program.programId
        );

        // Initialize the platform before running update tests
        before(async () => {
            try {
                await program.methods
                    .initializePlatform(new anchor.BN(10))
                    .accounts({
                        authority: authority.publicKey,
                        feeDestination: initialFeeDestination.publicKey,
                    })
                    .rpc();
            } catch (error) {
                // If initialization fails because account exists, that's okay
                if (!error.logs?.some(log => log.includes("already in use"))) {
                    throw error;
                }
            }
        });

        it("Successfully updates fee destination", async () => {
            await program.methods
                .updateFeeDestination()
                .accounts({
                    // @ts-ignore
                    authority: authority.publicKey,
                    newFeeDestination: newFeeDestination.publicKey,
                })
                .rpc();

            const platformState = await program.account.platformState.fetch(platformStatePda);
            expect(platformState.feeDestination.toString()).to.equal(newFeeDestination.publicKey.toString());
        });

        it("Prevents unauthorized fee destination updates", async () => {
            try {
                // First, airdrop some SOL to unauthorized user
                const airdropSignature = await provider.connection.requestAirdrop(
                    unauthorized.publicKey,
                    anchor.web3.LAMPORTS_PER_SOL
                );
                await provider.connection.confirmTransaction(airdropSignature);

                await program.methods
                    .updateFeeDestination()
                    .accounts({
                        // @ts-ignore
                        authority: unauthorized.publicKey,
                        newFeeDestination: newFeeDestination.publicKey,
                    })
                    .signers([unauthorized])
                    .rpc();

                assert.fail("Should have thrown an unauthorized error");
            } catch (err) {
                expect(err.error.errorCode.code).to.equal("Unauthorized");
            }
        });

        it("Can update fee destination multiple times", async () => {
            const anotherFeeDestination = anchor.web3.Keypair.generate();

            await program.methods
                .updateFeeDestination()
                .accounts({
                    // @ts-ignore
                    authority: authority.publicKey,
                    newFeeDestination: anotherFeeDestination.publicKey,
                })
                .rpc();

            const platformState = await program.account.platformState.fetch(platformStatePda);
            expect(platformState.feeDestination.toString()).to.equal(anotherFeeDestination.publicKey.toString());
        });
    });

    describe("buy coffee", () => {
        // Test accounts for this suite
        const authority = provider.wallet;
        const feeDestination = anchor.web3.Keypair.generate();
        const creator = anchor.web3.Keypair.generate();
        const contributor = anchor.web3.Keypair.generate();

        // Platform state PDA
        const [platformStatePda] = PublicKey.findProgramAddressSync(
            [Buffer.from("platform_state")],
            program.programId
        );

        // Initialize the platform before running buy tests
        before(async () => {
            try {
                // Airdrop more SOL to ensure sufficient funds for all operations
                // Contributor gets more for multiple transactions
                const airdropSignature = await provider.connection.requestAirdrop(
                    contributor.publicKey,
                    5 * anchor.web3.LAMPORTS_PER_SOL
                );
                await provider.connection.confirmTransaction(airdropSignature);

                // Creator needs enough for rent and receiving funds
                const creatorAirdrop = await provider.connection.requestAirdrop(
                    creator.publicKey,
                    2 * anchor.web3.LAMPORTS_PER_SOL
                );
                await provider.connection.confirmTransaction(creatorAirdrop);

                // Fee destination needs enough for rent and receiving fees
                const feeDestAirdrop = await provider.connection.requestAirdrop(
                    feeDestination.publicKey,
                    2 * anchor.web3.LAMPORTS_PER_SOL
                );
                await provider.connection.confirmTransaction(feeDestAirdrop);

                // Initialize platform with 10% fee
                await program.methods
                    .initializePlatform(new anchor.BN(10))
                    .accounts({
                        authority: authority.publicKey,
                        feeDestination: feeDestination.publicKey,
                    })
                    .rpc();
            } catch (error) {
                // If initialization fails because account exists, that's okay
                if (!error.logs?.some(log => log.includes("already in use"))) {
                    throw error;
                }
            }
        });

        it("Successfully processes payment with proper fee splitting", async () => {
            // Get platform state and verify fee percentage
            const platformState = await program.account.platformState.fetch(platformStatePda);
            const feePercentage = platformState.feePercentage.toNumber();

            // Additional safety airdrop to ensure accounts have enough SOL
            await provider.connection.confirmTransaction(
                await provider.connection.requestAirdrop(creator.publicKey, anchor.web3.LAMPORTS_PER_SOL)
            );
            await provider.connection.confirmTransaction(
                await provider.connection.requestAirdrop(platformState.feeDestination, anchor.web3.LAMPORTS_PER_SOL)
            );

            // Get initial balances
            const initialContributorBalance = await provider.connection.getBalance(contributor.publicKey);
            const initialCreatorBalance = await provider.connection.getBalance(creator.publicKey);
            const initialFeeDestBalance = await provider.connection.getBalance(platformState.feeDestination);

            const unitPrice = new anchor.BN(1_000_000);
            const units = new anchor.BN(5);

            // Calculate expected amounts using actual fee percentage
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
                })
                .signers([contributor])
                .rpc();

            // Get final balances
            const finalContributorBalance = await provider.connection.getBalance(contributor.publicKey);
            const finalCreatorBalance = await provider.connection.getBalance(creator.publicKey);
            const finalFeeDestBalance = await provider.connection.getBalance(platformState.feeDestination);

            // Calculate actual changes
            const creatorChange = finalCreatorBalance - initialCreatorBalance;
            const feeDestChange = finalFeeDestBalance - initialFeeDestBalance;
            const contributorChange = initialContributorBalance - finalContributorBalance;

            // Verify balances with actual amounts received
            expect(contributorChange).to.equal(totalAmount);
            expect(creatorChange).to.equal(expectedCreatorAmount);
            expect(feeDestChange).to.equal(expectedFeeAmount);
        });

        it("Fails when unit price is 0", async () => {
            const platformState = await program.account.platformState.fetch(platformStatePda);
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
                    })
                    .signers([contributor])
                    .rpc();

                assert.fail("Should have thrown invalid unit price error");
            } catch (err) {
                expect(err.error.errorCode.code).to.equal("InvalidUnitPrice");
            }
        });

        it("Fails when units is 0", async () => {
            const platformState = await program.account.platformState.fetch(platformStatePda);
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
                    })
                    .signers([contributor])
                    .rpc();

                assert.fail("Should have thrown invalid units error");
            } catch (err) {
                expect(err.error.errorCode.code).to.equal("InvalidUnits");
            }
        });

        it("Fails when contributor has insufficient funds", async () => {
            const platformState = await program.account.platformState.fetch(platformStatePda);
            const poorContributor = anchor.web3.Keypair.generate();
            const unitPrice = new anchor.BN(1_000_000_000); // 1 SOL per unit
            const units = new anchor.BN(1);

            try {
                await program.methods
                    .buyCoffee(units, unitPrice)
                    .accounts({
                        platformState: platformStatePda,
                        contributor: poorContributor.publicKey,
                        creator: creator.publicKey,
                        feeDestination: platformState.feeDestination,
                    })
                    .signers([poorContributor])
                    .rpc();

                assert.fail("Should have thrown insufficient funds error");
            } catch (err) {
                expect(err.logs.some(log =>
                    log.includes("insufficient lamports")
                )).to.be.true;
            }
        });

        it("Processes payment with different fee percentages correctly", async () => {
            // Get platform state
            const platformState = await program.account.platformState.fetch(platformStatePda);

            // Update fee to 20%
            await program.methods
                .updateFee(new anchor.BN(20))
                .accounts({
                    platformState: platformStatePda,
                    authority: authority.publicKey,
                })
                .rpc();

            // Get initial balances
            const initialContributorBalance = await provider.connection.getBalance(contributor.publicKey);
            const initialCreatorBalance = await provider.connection.getBalance(creator.publicKey);
            const initialFeeDestBalance = await provider.connection.getBalance(platformState.feeDestination);

            const unitPrice = new anchor.BN(1_000_000);
            const units = new anchor.BN(10);

            // Calculate expected amounts
            const totalAmount = unitPrice.toNumber() * units.toNumber();
            const expectedFeeAmount = Math.floor(totalAmount * 0.2); // 20% fee
            const expectedCreatorAmount = totalAmount - expectedFeeAmount;

            await program.methods
                .buyCoffee(units, unitPrice)
                .accounts({
                    platformState: platformStatePda,
                    contributor: contributor.publicKey,
                    creator: creator.publicKey,
                    feeDestination: platformState.feeDestination,
                })
                .signers([contributor])
                .rpc();

            // Get final balances
            const finalContributorBalance = await provider.connection.getBalance(contributor.publicKey);
            const finalCreatorBalance = await provider.connection.getBalance(creator.publicKey);
            const finalFeeDestBalance = await provider.connection.getBalance(platformState.feeDestination);

            // Verify balances
            const contributorChange = initialContributorBalance - finalContributorBalance;
            expect(contributorChange).to.equal(totalAmount);
            expect(finalCreatorBalance - initialCreatorBalance).to.equal(expectedCreatorAmount);
            expect(finalFeeDestBalance - initialFeeDestBalance).to.equal(expectedFeeAmount);
        });
    });

});