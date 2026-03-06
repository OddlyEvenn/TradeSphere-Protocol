import { ethers } from "ethers";
import dotenv from "dotenv";

// Import ABIs
import TradeRegistryABI from "../abis/TradeRegistry.json";
import LetterOfCreditABI from "../abis/LetterOfCredit.json";
import DocumentVerificationABI from "../abis/DocumentVerification.json";
import PaymentSettlementABI from "../abis/PaymentSettlement.json";

dotenv.config();

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!RPC_URL || !PRIVATE_KEY) {
    throw new Error("Missing SEPOLIA_RPC_URL or PRIVATE_KEY in environment variables");
}

export class BlockchainService {
    private static instance: BlockchainService;
    public provider: ethers.JsonRpcProvider;
    public wallet: ethers.Wallet;

    public tradeRegistry: ethers.Contract;
    public letterOfCredit: ethers.Contract;
    public documentVerification: ethers.Contract;
    public paymentSettlement: ethers.Contract;

    private constructor() {
        this.provider = new ethers.JsonRpcProvider(RPC_URL!);
        this.wallet = new ethers.Wallet(PRIVATE_KEY!, this.provider);

        this.tradeRegistry = new ethers.Contract(
            process.env.TRADE_REGISTRY_ADDRESS!,
            ((TradeRegistryABI as any).abi || TradeRegistryABI) as any,
            this.wallet
        );

        this.letterOfCredit = new ethers.Contract(
            process.env.LETTER_OF_CREDIT_ADDRESS!,
            ((LetterOfCreditABI as any).abi || LetterOfCreditABI) as any,
            this.wallet
        );

        this.documentVerification = new ethers.Contract(
            process.env.DOCUMENT_VERIFICATION_ADDRESS!,
            ((DocumentVerificationABI as any).abi || DocumentVerificationABI) as any,
            this.wallet
        );

        this.paymentSettlement = new ethers.Contract(
            process.env.PAYMENT_SETTLEMENT_ADDRESS!,
            ((PaymentSettlementABI as any).abi || PaymentSettlementABI) as any,
            this.wallet
        );
    }

    public static getInstance(): BlockchainService {
        if (!BlockchainService.instance) {
            BlockchainService.instance = new BlockchainService();
        }
        return BlockchainService.instance;
    }

    /**
     * Utility to format Wei to Ether
     */
    public formatEther(wei: bigint): string {
        return ethers.formatEther(wei);
    }

    /**
     * Utility to parse Ether to Wei
     */
    public parseEther(ether: string): bigint {
        return ethers.parseEther(ether);
    }
}

export const blockchainService = BlockchainService.getInstance();
