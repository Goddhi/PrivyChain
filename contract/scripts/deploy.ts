import { ethers, run } from "hardhat";

async function main() {
    console.log("Starting PrivyChain deployment...");

    // Get the contract factory
    const PrivyChain = await ethers.getContractFactory("PrivyChain");

    // Constructor parameters
    // Set to address(0) to use native FIL rewards instead of ERC20 token
    const rewardTokenAddress = "0x0000000000000000000000000000000000000000";

    console.log("Deploying PrivyChain contract...");
    console.log("Reward token address:", rewardTokenAddress);

    // Deploy the contract
    const privyChain = await PrivyChain.deploy(rewardTokenAddress);

    // Wait for deployment to complete
    await privyChain.waitForDeployment();

    const contractAddress = await privyChain.getAddress();

    console.log("✅ PrivyChain deployed successfully!");
    console.log("Contract address:", contractAddress);
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Deployer:", await privyChain.owner());

    // Display initial configuration
    console.log("\n📊 Initial Configuration:");
    console.log("Base reward amount:", ethers.formatEther(await privyChain.baseRewardAmount()), "FIL");
    console.log("Size multiplier:", await privyChain.sizeMultiplier());
    console.log("Encryption bonus:", ethers.formatEther(await privyChain.encryptionBonus()), "FIL");
    console.log("Authorization required:", await privyChain.requireAuthorization());
    console.log("Using token rewards:", await privyChain.useTokenRewards());

    // Fund the contract with some FIL for rewards if not using token rewards
    if (!(await privyChain.useTokenRewards())) {
        console.log("\n💰 Funding contract with FIL for rewards...");
        const fundingAmount = ethers.parseEther("1.0"); // 1 FIL

        const [deployer] = await ethers.getSigners();
        const tx = await deployer.sendTransaction({
            to: contractAddress,
            value: fundingAmount
        });

        await tx.wait();
        console.log("✅ Contract funded with", ethers.formatEther(fundingAmount), "FIL");
    }

    console.log("\n🎉 Deployment completed successfully!");
    console.log("You can now interact with the PrivyChain contract at:", contractAddress);

    // Optional: Verify contract if deploying to a public network
    if (process.env.ETHERSCAN_API_KEY) {
        console.log("\n🔍 Waiting for block confirmations before verification...");

        const deployTx = privyChain.deploymentTransaction();
        if (deployTx) {
            await deployTx.wait(5);
        }

        try {
            console.log("Verifying contract on explorer...");
            await run("verify:verify", {
                address: contractAddress,
                constructorArguments: [rewardTokenAddress],
            });
            console.log("✅ Contract verified successfully!");
        } catch (error) {
            console.log("❌ Verification failed:", error);
        }
    }
}

// Error handling
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });