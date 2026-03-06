import { ethers } from "ethers";

// Import ABIs
import TradeRegistryABI from "../abis/TradeRegistry.json";
import LetterOfCreditABI from "../abis/LetterOfCredit.json";
import DocumentVerificationABI from "../abis/DocumentVerification.json";
import PaymentSettlementABI from "../abis/PaymentSettlement.json";

// Contract Addresses (Should match backend .env)
const ADDRESSES = {
    TradeRegistry: "0x0f965Ec7a519D9c50782A1bC6Cc0836E0C272Af4",
    LetterOfCredit: "0x66184b34777E58eb66Fa627C207ACaAc24f55224",
    DocumentVerification: "0xF45337A8c134b50D247A5e62e7727e3F940a2F13",
    PaymentSettlement: "0x580e39A1AdB5FEE9A117fF0A6B7acE44F4438359",
};

const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111

export class WalletService {
    private static instance: WalletService;
    public provider: ethers.BrowserProvider | null = null;
    public signer: ethers.JsonRpcSigner | null = null;

    private constructor() { }

    public static getInstance(): WalletService {
        if (!WalletService.instance) {
            WalletService.instance = new WalletService();
        }
        return WalletService.instance;
    }

    public async connect(): Promise<string | null> {
        if (!window.ethereum) {
            console.error("MetaMask not found! Please install it.");
            return null;
        }

        try {
            this.provider = new ethers.BrowserProvider(window.ethereum);

            // Request accounts
            const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
            this.signer = await this.provider.getSigner();

            // Check Network
            const network = await this.provider.getNetwork();
            if (network.chainId !== 11155111n) {
                await this.switchToSepolia();
            }

            return accounts[0];
        } catch (error) {
            console.error("Connection failed", error);
            return null;
        }
    }

    private async switchToSepolia() {
        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: SEPOLIA_CHAIN_ID }],
            });
        } catch (switchError: any) {
            // This error code indicates that the chain has not been added to MetaMask.
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [
                        {
                            chainId: SEPOLIA_CHAIN_ID,
                            chainName: "Sepolia Test Network",
                            rpcUrls: ["https://rpc.sepolia.org"],
                            nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
                            blockExplorerUrls: ["https://sepolia.etherscan.io"],
                        },
                    ],
                });
            }
        }
    }

    // Contract Getters
    public getTradeRegistry() {
        if (!this.signer) throw new Error("Wallet not connected");
        return new ethers.Contract(ADDRESSES.TradeRegistry, TradeRegistryABI, this.signer);
    }

    public getLetterOfCredit() {
        if (!this.signer) throw new Error("Wallet not connected");
        return new ethers.Contract(ADDRESSES.LetterOfCredit, LetterOfCreditABI, this.signer);
    }

    public getDocumentVerification() {
        if (!this.signer) throw new Error("Wallet not connected");
        return new ethers.Contract(ADDRESSES.DocumentVerification, DocumentVerificationABI, this.signer);
    }

    public getPaymentSettlement() {
        if (!this.signer) throw new Error("Wallet not connected");
        return new ethers.Contract(ADDRESSES.PaymentSettlement, PaymentSettlementABI, this.signer);
    }
}

export const walletService = WalletService.getInstance();
