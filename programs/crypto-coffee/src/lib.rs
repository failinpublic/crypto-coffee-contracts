use anchor_lang::prelude::*;

declare_id!("3ujQg6Cqf5XycaPGRbEqZkTwRQSDmE8ThKfZXhCMy5o9");

#[program]
pub mod crypto_coffee {
    use super::*;

    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        platform_fee_percentage: u64,
    ) -> Result<()> {
        require!(
            platform_fee_percentage <= 100,
            ErrorCode::InvalidFeePercentage
        );

        let state = &mut ctx.accounts.platform_state;
        state.authority = ctx.accounts.authority.key();
        state.fee_destination = ctx.accounts.fee_destination.key();
        state.fee_percentage = platform_fee_percentage;

        emit!(PlatformInitialized {
            authority: state.authority,
            fee_destination: state.fee_destination,
            fee_percentage: state.fee_percentage,
        });

        Ok(())
    }

    pub fn update_fee(
        ctx: Context<UpdateFee>,
        new_fee_percentage: u64,
    ) -> Result<()> {
        require!(
            new_fee_percentage <= 100,
            ErrorCode::InvalidFeePercentage
        );

        let state = &mut ctx.accounts.platform_state;
        state.fee_percentage = new_fee_percentage;

        emit!(FeeUpdated {
            new_fee_percentage,
        });


        Ok(())
    }

    pub fn update_fee_destination(
        ctx: Context<UpdateFeeDestination>,
    ) -> Result<()> {
        let state = &mut ctx.accounts.platform_state;
        state.fee_destination = ctx.accounts.new_fee_destination.key();

        emit!(FeeDestinationUpdated {
            new_fee_destination: state.fee_destination,
        });

        Ok(())
    }

    pub fn buy_coffee(
        ctx: Context<BuyCoffee>,
        units_bought: u64,
        unit_price: u64,
    ) -> Result<()> {
        require!(units_bought > 0, ErrorCode::InvalidUnits);
        require!(unit_price > 0, ErrorCode::InvalidUnitPrice);

        let platform_state = &ctx.accounts.platform_state;

        let total_amount = units_bought
            .checked_mul(unit_price)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        let fee_amount = total_amount
            .checked_mul(platform_state.fee_percentage)
            .ok_or(ErrorCode::ArithmeticOverflow)?
            .checked_div(100)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        let creator_amount = total_amount
            .checked_sub(fee_amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        // Transfer fee to platform
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.contributor.to_account_info(),
                    to: ctx.accounts.fee_destination.to_account_info(),
                },
            ),
            fee_amount,
        )?;

        // Transfer remaining amount to creator
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.contributor.to_account_info(),
                    to: ctx.accounts.creator.to_account_info(),
                },
            ),
            creator_amount,
        )?;

        emit!(CoffeePurchased {
            contributor: ctx.accounts.contributor.key(),
            creator: ctx.accounts.creator.key(),
            total_amount,
            fee_amount,
            creator_amount,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + PlatformState::INIT_SPACE,
        seeds = [b"platform_state"],
        bump
    )]
    pub platform_state: Account<'info, PlatformState>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: This account is safe because we only store its pubkey and verify it's a system-owned account
    #[account(owner = System::id() @ ErrorCode::InvalidFeeDestination)]
    pub fee_destination: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateFee<'info> {
    #[account(
        mut,
        seeds = [b"platform_state"],
        bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub platform_state: Account<'info, PlatformState>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateFeeDestination<'info> {
    #[account(
        mut,
        seeds = [b"platform_state"],
        bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub platform_state: Account<'info, PlatformState>,

    pub authority: Signer<'info>,

    /// CHECK: This account is safe because we only store its pubkey and verify it's a system-owned account
    #[account(owner = System::id() @ ErrorCode::InvalidFeeDestination)]
    pub new_fee_destination: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct BuyCoffee<'info> {
    pub platform_state: Account<'info, PlatformState>,

    #[account(mut)]
    pub contributor: Signer<'info>,

    /// CHECK: This is safe as we only transfer SOL to this account
    #[account(mut)]
    pub creator: AccountInfo<'info>,

    /// CHECK: This is safe as we only transfer SOL to this account
    #[account(
        mut,
        constraint = fee_destination.key() == platform_state.fee_destination @ ErrorCode::InvalidFeeDestination
    )]
    pub fee_destination: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct PlatformState {
    pub authority: Pubkey,
    pub fee_destination: Pubkey,
    pub fee_percentage: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid platform fee specified. Fee must be between 0 and 100.")]
    InvalidFeePercentage,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid fee destination")]
    InvalidFeeDestination,
    #[msg("Must buy at least one coffee")]
    InvalidUnits,
    #[msg("Unit price must be greater than 0")]
    InvalidUnitPrice,
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,
}


#[event]
pub struct PlatformInitialized {
    pub authority: Pubkey,
    pub fee_destination: Pubkey,
    pub fee_percentage: u64,
}

#[event]
pub struct FeeUpdated {
    pub new_fee_percentage: u64,
}

#[event]
pub struct FeeDestinationUpdated {
    pub new_fee_destination: Pubkey,
}

#[event]
pub struct CoffeePurchased {
    pub contributor: Pubkey,
    pub creator: Pubkey,
    pub total_amount: u64,
    pub fee_amount: u64,
    pub creator_amount: u64,
}
