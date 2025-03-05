# Crypto Coffee CLI Tool

## Running Commands:
Before each command you need to set the `ANCHOR_PROVIDER_URL` `ANCHOR_WALLET` env variables.


### Update Fee Destination:
```
ts-node ./cli/cli.ts update-fee-destination <NEW_FEE_DESTINATION_PUBLIC_KEY>
```

### Update Fee Percentage:
```
ts-node ./cli/cli.ts update-fee <NEW_FEE_PERCENTAGE>
```

### Add a Creator Discount:
```
ts-node ./cli/cli.ts add-creator-discount <CREATOR_PUBLIC_KEY> <FEE_PERCENTAGE>
```

### Update a Creator Discount:
```
ts-node ./cli/cli.ts update-creator-discount <CREATOR_PUBLIC_KEY> <NEW_FEE_PERCENTAGE>
```

### Remove a Creator Discount:
```
ts-node ./cli/cli.ts remove-creator-discount <CREATOR_PUBLIC_KEY>
```