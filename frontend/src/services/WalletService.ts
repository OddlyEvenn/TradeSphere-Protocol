import { ethers } from "ethers";

// Import ABIs
import TradeRegistryABI from "../abis/TradeRegistry.json";
import LetterOfCreditABI from "../abis/LetterOfCredit.json";
import DocumentVerificationABI from "../abis/DocumentVerification.json";
import PaymentSettlementABI from "../abis/PaymentSettlement.json";

// Contract Addresses (Should match backend .env)
const ADDRESSES = {
    TradeRegistry: "0x9A1ED75e2405452e05b76cA8aABE391a5CBbA037",
    LetterOfCredit: "0x161BD8c72ad5c4f02375D8ad3098c2919719ebD4",
    DocumentVerification: "0x69a2BF2624F36c2fBda4899E8404Ad43c92D0D58",
    PaymentSettlement: "0x7440f3265a9F87524272640E9722D4A05fF9bf92",
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
        if (!(window as any).ethereum) {
            console.error("MetaMask not found! Please install it.");
            return null;
        }

        try {
            this.provider = new ethers.BrowserProvider((window as any).ethereum);

            // Request accounts
            const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
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
            await (window as any).ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: SEPOLIA_CHAIN_ID }],
            });
        } catch (switchError: any) {
            // This error code indicates that the chain has not been added to MetaMask.
            if (switchError.code === 4902) {
                await (window as any).ethereum.request({
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
        return new ethers.Contract(ADDRESSES.TradeRegistry, ((TradeRegistryABI as any).abi || TradeRegistryABI) as any, this.signer);
    }

    public getLetterOfCredit() {
        if (!this.signer) throw new Error("Wallet not connected");
        return new ethers.Contract(ADDRESSES.LetterOfCredit, ((LetterOfCreditABI as any).abi || LetterOfCreditABI) as any, this.signer);
    }

    public getDocumentVerification() {
        if (!this.signer) throw new Error("Wallet not connected");
        return new ethers.Contract(ADDRESSES.DocumentVerification, ((DocumentVerificationABI as any).abi || DocumentVerificationABI) as any, this.signer);
    }

    public getPaymentSettlement() {
        if (!this.signer) throw new Error("Wallet not connected");
        return new ethers.Contract(ADDRESSES.PaymentSettlement, ((PaymentSettlementABI as any).abi || PaymentSettlementABI) as any, this.signer);
    }
}

export const walletService = WalletService.getInstance();
