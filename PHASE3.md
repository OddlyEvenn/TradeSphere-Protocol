# Phase 3: Compilation, Testing, and Deployment

## 1. Local Compilation & Testing
- Compile the newly architected contracts (Logic, Storage, Proxy).
- Run comprehensive local test suites to ensure the separation of concerns is functioning properly.
- Specifically simulate the trade finance lifecycle, including:
  - The merged Customs/Tax options (`clear`, `flags`, `entry rejection`).
  - The 24-hour voting process and the 4-vote threshold outcomes.

## 2. Testnet Deployment
- Authenticate and deploy the optimized, refined smart contracts to the **Sepolia Testnet**.
- Verify transaction finality, ensure gas optimization holds up in a live-like network, and test the proxy upgrade paths.

## 3. Environment Variable & ABI Synchronization
- Retrieve the deployed smart contract addresses from the Sepolia network.
- **Backend Update**: Inject the new contract addresses into the backend environment variables (`.env`).
- **Frontend & Backend ABIs**:
  - Extract the Application Binary Interfaces (ABIs) generated from the compilation step.
  - Update and overwrite the respective ABI JSON files within both the Backend directory and the Frontend directories to assure absolute API alignment across the stack.
