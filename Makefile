.PHONY: build deploy upgrade verify remote

NETWORK := https://api.devnet.solana.com
PROGRAM_ID := 3ujQg6Cqf5XycaPGRbEqZkTwRQSDmE8ThKfZXhCMy5o9
KEYPAIR := $(HOME)/.config/solana/crypto-coffee/dev-wallet.json
COMMIT := bd500d170305409694256eea3f3080cfebdf65d0

build:
	DOCKER_DEFAULT_PLATFORM=linux/amd64 anchor build --verifiable

deploy:
	anchor deploy --provider.cluster=$(NETWORK) --provider.wallet=$(KEYPAIR) --verifiable

migrate:
	anchor migrate --provider.cluster $(NETWORK) --provider.wallet $(KEYPAIR)

upgrade:
	anchor upgrade --provider.cluster=$(NETWORK) --provider.wallet=$(KEYPAIR) --program-id=$(PROGRAM_ID) ./target/verifiable/crypto_coffee.so

verify:
	DOCKER_DEFAULT_PLATFORM=linux/amd64 solana-verify verify-from-repo https://github.com/failinpublic/crypto-coffee-contracts \
		--url $(PROGRAM_ID) \
		--program-id $(PROGRAM_ID)  \
		--commit-hash $(COMMIT) \
		--library-name crypto_coffee \
		--keypair $(KEYPAIR)

remote:
	DOCKER_DEFAULT_PLATFORM=linux/amd64 solana-verify verify-from-repo https://github.com/failinpublic/crypto-coffee-contracts \
		--url $(PROGRAM_ID) \
		--program-id $(PROGRAM_ID)  \
		--commit-hash $(COMMIT) \
		--library-name crypto_coffee \
		--keypair $(KEYPAIR) \
		--remote
