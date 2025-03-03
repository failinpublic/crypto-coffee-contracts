.PHONY: build deploy-localnet deploy-devnet

build:
	DOCKER_DEFAULT_PLATFORM=linux/amd64 anchor build --verifiable

deploy-localnet:
	anchor deploy

deploy-devnet:
	anchor deploy --provider.cluster=devnet \
		--provider.wallet=$(HOME)/.config/solana/crypto-coffee/dev-wallet.json --verifiable

upgrade-devnet:
	anchor upgrade --provider.cluster=devnet \
		--provider.wallet=$(HOME)/.config/solana/crypto-coffee/dev-wallet.json \
		--program-id=3ujQg6Cqf5XycaPGRbEqZkTwRQSDmE8ThKfZXhCMy5o9 \
		./target/verifiable/crypto_coffee.so


verify-devnet:
	DOCKER_DEFAULT_PLATFORM=linux/amd64 anchor verify --provider.cluster=devnet \
			--provider.wallet=$(HOME)/.config/solana/crypto-coffee/dev-wallet.json \
			--skip-build \
			--docker-image backpackapp/build:v0.30.1 \
			--solana-version 2.0.24 \
			--program-name crypto_coffee \
			3ujQg6Cqf5XycaPGRbEqZkTwRQSDmE8ThKfZXhCMy5o9