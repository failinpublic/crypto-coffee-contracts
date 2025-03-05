.PHONY: build deploy upgrade verify remote

NETWORK ?= https://api.devnet.solana.com
PROGRAM_ID ?= 3ujQg6Cqf5XycaPGRbEqZkTwRQSDmE8ThKfZXhCMy5o9
KEYPAIR ?= $(HOME)/.config/solana/crypto-coffee/dev-wallet.json
COMMIT ?= f5e1e6798479eef22a197b0e8af01a2b2ccc84cd

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
		--url $(NETWORK) \
		--program-id $(PROGRAM_ID)  \
		--commit-hash $(COMMIT) \
		--library-name crypto_coffee \
		--keypair $(KEYPAIR)

remote:
	DOCKER_DEFAULT_PLATFORM=linux/amd64 solana-verify verify-from-repo https://github.com/failinpublic/crypto-coffee-contracts \
		--url $(NETWORK) \
		--program-id $(PROGRAM_ID)  \
		--commit-hash $(COMMIT) \
		--library-name crypto_coffee \
		--keypair $(KEYPAIR) \
		--remote
