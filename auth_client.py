"""
Microsoft Authentication Client for Fabric Analytics
Supports Bearer Token, Service Principal, and Device Code authentication methods
"""

import json
import time
import webbrowser
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple, Union
from dataclasses import dataclass
from enum import Enum
import sys

try:
    import msal
    MSAL_AVAILABLE = True
except ImportError:
    MSAL_AVAILABLE = False

class AuthMethod(Enum):
    """Authentication methods supported by the client"""
    BEARER_TOKEN = "bearer"
    SERVICE_PRINCIPAL = "service_principal"
    DEVICE_CODE = "device_code"
    INTERACTIVE = "interactive"

@dataclass
class AuthResult:
    """Result of authentication containing access token and metadata"""
    access_token: str
    expires_on: datetime
    account: Optional[Dict] = None
    refresh_token: Optional[str] = None
    
    def is_valid(self) -> bool:
        """Check if the token is still valid"""
        return self.expires_on > datetime.now()
    
    def expires_in_seconds(self) -> int:
        """Get seconds until token expires"""
        delta = self.expires_on - datetime.now()
        return max(0, int(delta.total_seconds()))

class MicrosoftAuthClient:
    """Microsoft Authentication Client supporting multiple auth flows"""
    
    DEFAULT_SCOPE = ["https://api.fabric.microsoft.com/.default"]
    DEFAULT_AUTHORITY = "https://login.microsoftonline.com/common"
    
    def __init__(self, client_id: Optional[str] = None, authority: Optional[str] = None):
        """
        Initialize the authentication client
        
        Args:
            client_id: Application (client) ID
            authority: Authority URL (defaults to common endpoint)
        """
        self.client_id = client_id
        self.authority = authority or self.DEFAULT_AUTHORITY
        self.app: Optional[msal.ClientApplication] = None
        self._check_msal_availability()
    
    def _check_msal_availability(self):
        """Check if MSAL is available and provide installation instructions if not"""
        if not MSAL_AVAILABLE:
            print("\n❌ MSAL (Microsoft Authentication Library) is not installed.")
            print("To use Microsoft authentication, please install it:")
            print("pip install msal")
            print("\nFalling back to bearer token authentication only.")
    
    def authenticate_with_bearer_token(self, token: str) -> AuthResult:
        """
        Authenticate using a bearer token
        
        Args:
            token: Bearer token (with or without 'Bearer ' prefix)
            
        Returns:
            AuthResult with the provided token
        """
        # Clean up token format
        if token.startswith('Bearer '):
            access_token = token[7:]  # Remove 'Bearer ' prefix
        else:
            access_token = token
        
        # Basic token validation (check if it's JWT-like)
        parts = access_token.split('.')
        if len(parts) != 3:
            raise ValueError("Invalid bearer token format. Token does not appear to be a valid JWT.")
        
        # Default expiry to 1 hour from now
        expires_on = datetime.now() + timedelta(hours=1)
        
        return AuthResult(
            access_token=access_token,
            expires_on=expires_on
        )
    
    def authenticate_with_service_principal(
        self, 
        client_id: str, 
        client_secret: str, 
        tenant_id: str,
        scope: Optional[list] = None
    ) -> AuthResult:
        """
        Authenticate using service principal (client credentials flow)
        
        Args:
            client_id: Application (client) ID
            client_secret: Client secret
            tenant_id: Tenant ID
            scope: List of scopes (defaults to Fabric default scope)
            
        Returns:
            AuthResult with access token
        """
        if not MSAL_AVAILABLE:
            raise RuntimeError("MSAL is required for service principal authentication. Please install with: pip install msal")
        
        authority = f"https://login.microsoftonline.com/{tenant_id}"
        scope = scope or self.DEFAULT_SCOPE
        
        # Create confidential client application
        app = msal.ConfidentialClientApplication(
            client_id=client_id,
            client_credential=client_secret,
            authority=authority
        )
        
        # Acquire token
        result = app.acquire_token_for_client(scopes=scope)
        
        if "error" in result:
            error_msg = result.get("error_description", result.get("error", "Unknown error"))
            raise RuntimeError(f"Service principal authentication failed: {error_msg}")
        
        # Calculate expiry time
        expires_in = result.get("expires_in", 3600)  # Default to 1 hour
        expires_on = datetime.now() + timedelta(seconds=expires_in)
        
        return AuthResult(
            access_token=result["access_token"],
            expires_on=expires_on,
            account=result.get("account")
        )
    
    def authenticate_with_device_code(
        self, 
        client_id: str, 
        tenant_id: Optional[str] = None,
        scope: Optional[list] = None
    ) -> AuthResult:
        """
        Authenticate using device code flow
        
        Args:
            client_id: Application (client) ID
            tenant_id: Tenant ID (optional, defaults to common)
            scope: List of scopes (defaults to Fabric default scope)
            
        Returns:
            AuthResult with access token
        """
        if not MSAL_AVAILABLE:
            raise RuntimeError("MSAL is required for device code authentication. Please install with: pip install msal")
        
        authority = f"https://login.microsoftonline.com/{tenant_id}" if tenant_id else self.authority
        scope = scope or self.DEFAULT_SCOPE
        
        # Create public client application
        app = msal.PublicClientApplication(
            client_id=client_id,
            authority=authority
        )
        
        # Initiate device flow
        flow = app.initiate_device_flow(scopes=scope)
        
        if "user_code" not in flow:
            raise RuntimeError("Failed to create device flow")
        
        # Display device code to user
        print("\n" + "="*50)
        print("🔐 DEVICE CODE AUTHENTICATION")
        print("="*50)
        print(f"📱 Please visit: {flow['verification_uri']}")
        print(f"🔑 Enter the code: {flow['user_code']}")
        print(f"⏰ Code expires in: {flow['expires_in']} seconds")
        print("⏳ Waiting for authentication...")
        print("="*50 + "\n")
        
        # Complete device flow
        result = app.acquire_token_by_device_flow(flow)
        
        if "error" in result:
            error_msg = result.get("error_description", result.get("error", "Unknown error"))
            raise RuntimeError(f"Device code authentication failed: {error_msg}")
        
        # Calculate expiry time
        expires_in = result.get("expires_in", 3600)  # Default to 1 hour
        expires_on = datetime.now() + timedelta(seconds=expires_in)
        
        print("✅ Authentication successful!")
        
        return AuthResult(
            access_token=result["access_token"],
            expires_on=expires_on,
            account=result.get("account"),
            refresh_token=result.get("refresh_token")
        )
    
    def authenticate_interactively(
        self, 
        client_id: str, 
        tenant_id: Optional[str] = None,
        scope: Optional[list] = None
    ) -> AuthResult:
        """
        Authenticate using interactive flow (opens browser)
        
        Args:
            client_id: Application (client) ID
            tenant_id: Tenant ID (optional, defaults to common)
            scope: List of scopes (defaults to Fabric default scope)
            
        Returns:
            AuthResult with access token
        """
        if not MSAL_AVAILABLE:
            raise RuntimeError("MSAL is required for interactive authentication. Please install with: pip install msal")
        
        authority = f"https://login.microsoftonline.com/{tenant_id}" if tenant_id else self.authority
        scope = scope or self.DEFAULT_SCOPE
        
        # Create public client application
        app = msal.PublicClientApplication(
            client_id=client_id,
            authority=authority
        )
        
        print("\n" + "="*50)
        print("🌐 INTERACTIVE AUTHENTICATION")
        print("="*50)
        print("🔄 Opening browser for authentication...")
        print("="*50 + "\n")
        
        # Try to acquire token interactively
        result = app.acquire_token_interactive(scopes=scope)
        
        if "error" in result:
            error_msg = result.get("error_description", result.get("error", "Unknown error"))
            raise RuntimeError(f"Interactive authentication failed: {error_msg}")
        
        # Calculate expiry time
        expires_in = result.get("expires_in", 3600)  # Default to 1 hour
        expires_on = datetime.now() + timedelta(seconds=expires_in)
        
        print("✅ Authentication successful!")
        
        return AuthResult(
            access_token=result["access_token"],
            expires_on=expires_on,
            account=result.get("account"),
            refresh_token=result.get("refresh_token")
        )
    
    @staticmethod
    def prompt_for_auth_method() -> AuthMethod:
        """
        Prompt user to select authentication method
        
        Returns:
            Selected AuthMethod
        """
        print("\n" + "="*60)
        print("🔐 AUTHENTICATION METHOD SELECTION")
        print("="*60)
        print("1. 🎫 Bearer Token (provide your own token)")
        print("2. 🤖 Service Principal (client ID + secret + tenant)")
        print("3. 📱 Device Code (sign in with browser on another device)")
        print("4. 🌐 Interactive (sign in with browser - opens automatically)")
        print("="*60)
        
        while True:
            try:
                choice = input("Enter your choice (1-4): ").strip()
                if choice == "1":
                    return AuthMethod.BEARER_TOKEN
                elif choice == "2":
                    return AuthMethod.SERVICE_PRINCIPAL
                elif choice == "3":
                    return AuthMethod.DEVICE_CODE
                elif choice == "4":
                    return AuthMethod.INTERACTIVE
                else:
                    print("❌ Invalid choice. Please enter 1, 2, 3, or 4.")
            except KeyboardInterrupt:
                print("\n🚫 Authentication cancelled by user.")
                sys.exit(0)
    
    @staticmethod
    def prompt_for_bearer_token() -> str:
        """
        Prompt user to enter bearer token
        
        Returns:
            Bearer token string
        """
        print("\n" + "="*60)
        print("🎫 BEARER TOKEN INPUT")
        print("="*60)
        print("Please enter your bearer token:")
        print("• Include 'Bearer ' prefix if you have it")
        print("• Or just paste the token value")
        print("="*60)
        
        token = input("Bearer token: ").strip()
        if not token:
            raise ValueError("Bearer token cannot be empty")
        
        return token
    
    @staticmethod
    def prompt_for_service_principal() -> Tuple[str, str, str]:
        """
        Prompt user to enter service principal credentials
        
        Returns:
            Tuple of (client_id, client_secret, tenant_id)
        """
        print("\n" + "="*60)
        print("🤖 SERVICE PRINCIPAL CREDENTIALS")
        print("="*60)
        print("Please enter your service principal details:")
        print("="*60)
        
        client_id = input("Client ID (Application ID): ").strip()
        if not client_id:
            raise ValueError("Client ID cannot be empty")
        
        client_secret = input("Client Secret: ").strip()
        if not client_secret:
            raise ValueError("Client Secret cannot be empty")
        
        tenant_id = input("Tenant ID (Directory ID): ").strip()
        if not tenant_id:
            raise ValueError("Tenant ID cannot be empty")
        
        return client_id, client_secret, tenant_id
    
    @staticmethod
    def prompt_for_device_code_details() -> Tuple[str, Optional[str]]:
        """
        Prompt user to enter device code authentication details
        
        Returns:
            Tuple of (client_id, tenant_id)
        """
        print("\n" + "="*60)
        print("📱 DEVICE CODE AUTHENTICATION")
        print("="*60)
        print("Please enter your application details:")
        print("="*60)
        
        client_id = input("Client ID (Application ID): ").strip()
        if not client_id:
            raise ValueError("Client ID cannot be empty")
        
        tenant_id = input("Tenant ID (optional, press Enter for common): ").strip()
        if not tenant_id:
            tenant_id = None
        
        return client_id, tenant_id
    
    @staticmethod
    def prompt_for_interactive_details() -> Tuple[str, Optional[str]]:
        """
        Prompt user to enter interactive authentication details
        
        Returns:
            Tuple of (client_id, tenant_id)
        """
        print("\n" + "="*60)
        print("🌐 INTERACTIVE AUTHENTICATION")
        print("="*60)
        print("Please enter your application details:")
        print("="*60)
        
        client_id = input("Client ID (Application ID): ").strip()
        if not client_id:
            raise ValueError("Client ID cannot be empty")
        
        tenant_id = input("Tenant ID (optional, press Enter for common): ").strip()
        if not tenant_id:
            tenant_id = None
        
        return client_id, tenant_id
    
    def authenticate(self) -> AuthResult:
        """
        Interactive authentication flow - prompts user for method and credentials
        
        Returns:
            AuthResult with access token
        """
        try:
            auth_method = self.prompt_for_auth_method()
            
            if auth_method == AuthMethod.BEARER_TOKEN:
                token = self.prompt_for_bearer_token()
                return self.authenticate_with_bearer_token(token)
            
            elif auth_method == AuthMethod.SERVICE_PRINCIPAL:
                client_id, client_secret, tenant_id = self.prompt_for_service_principal()
                return self.authenticate_with_service_principal(client_id, client_secret, tenant_id)
            
            elif auth_method == AuthMethod.DEVICE_CODE:
                client_id, tenant_id = self.prompt_for_device_code_details()
                return self.authenticate_with_device_code(client_id, tenant_id)
            
            elif auth_method == AuthMethod.INTERACTIVE:
                client_id, tenant_id = self.prompt_for_interactive_details()
                return self.authenticate_interactively(client_id, tenant_id)
            
            else:
                raise ValueError(f"Unsupported authentication method: {auth_method}")
                
        except KeyboardInterrupt:
            print("\n🚫 Authentication cancelled by user.")
            sys.exit(0)
        except Exception as e:
            print(f"\n❌ Authentication failed: {e}")
            raise

def main():
    """Demo/test function for the authentication client"""
    print("🔐 Microsoft Fabric Authentication Client Demo")
    print("=" * 60)
    
    client = MicrosoftAuthClient()
    
    try:
        auth_result = client.authenticate()
        
        print("\n✅ Authentication successful!")
        print(f"📅 Token expires: {auth_result.expires_on}")
        print(f"⏱️  Expires in: {auth_result.expires_in_seconds()} seconds")
        
        if auth_result.account:
            print(f"👤 Account: {auth_result.account.get('username', 'Unknown')}")
        
        # Test token format
        print(f"\n🔑 Token preview: {auth_result.access_token[:20]}...")
        
        return auth_result
        
    except Exception as e:
        print(f"\n❌ Authentication failed: {e}")
        return None

if __name__ == "__main__":
    main()
