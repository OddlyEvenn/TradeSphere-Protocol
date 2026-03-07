import { ethers } from "ethers";

// Import ABIs
import TradeRegistryABI from "../abis/TradeRegistry.json";
import LetterOfCreditABI from "../abis/LetterOfCredit.json";
import DocumentVerificationABI from "../abis/DocumentVerification.json";
import PaymentSettlementABI from "../abis/PaymentSettlement.json";

// Contract Addresses (Should match backend .env)
const ADDRESSES = {
    TradeRegistry: "0x23C2909C6543321FC6665FbC24E9F0DC9cA16013",
    LetterOfCredit: "0x51d097b95030AA65f7d21404D5252A1A49a9b438",
    DocumentVerification: "0x7AC3132C165F9BeAfb5E07b7654b0b4E2C81F04e",
    PaymentSettlement: "0xF5D778003490A4E8EC0896Acb5f95AcB2182702D",
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
