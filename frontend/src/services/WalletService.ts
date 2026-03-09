import { ethers } from "ethers";

// Import ABIs
import TradeRegistryABI from "../abis/TradeRegistry.json";
import LetterOfCreditABI from "../abis/LetterOfCredit.json";
import DocumentVerificationABI from "../abis/DocumentVerification.json";
import PaymentSettlementABI from "../abis/PaymentSettlement.json";

// Contract Addresses (Should match backend .env)
const ADDRESSES = {
    TradeRegistry: "0xf76d952C4181c692CA250450De2921a1c36D51DB",
    LetterOfCredit: "0xF717Dfe4069232336B9A52de2324e6afbB1837a7",
    DocumentVerification: "0xC31B3940D04A6D90d3Bd94EA1E4f1d866E92B2CA",
    PaymentSettlement: "0xb295F9fA5881D5870985061beA83FC2D3d203e00",
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
            // Request accounts first
            const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });

            // Create a temporary provider to check the current network
            let tempProvider = new ethers.BrowserProvider((window as any).ethereum);
            const network = await tempProvider.getNetwork();

            // Switch to Sepolia if not already on it
            if (network.chainId !== 11155111n) {
                await this.switchToSepolia();
                // IMPORTANT: After network switch, re-create the provider so ethers.js
                // doesn't cache the old chainId and throw NETWORK_ERROR
            }

            // Create the final provider and signer on the correct network
            this.provider = new ethers.BrowserProvider((window as any).ethereum);
            this.signer = await this.provider.getSigner();

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
