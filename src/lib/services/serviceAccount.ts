
import type { ServiceAccount } from 'firebase-admin';

// As credenciais da conta de serviço são incorporadas diretamente para evitar problemas de leitura de arquivo.
export const serviceAccountCredentials = {
  "type": "service_account",
  "project_id": "cotao-online",
  "private_key_id": "1fc9d4f74fcca12e154148e2157c1774b4c9f7e4",
  "private_key": `-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCjiX/8vwvclQ9D\nFN+mY17g20mDIb0OSZyuZCSoYTaXaku4qTXgIEp7WOb3FtnteGGM0P95pQf8++NN\ncNoEAKCbuN3+2iBmsyLc0t8+e2hOOqRTJPHaImU9u40768SszCtAr/9spfmA2Ile\nN7i6KdM4m8yFBFD4/xb8GSX/aCSQZS9OJb0ctkoj2/P2i5tsVCKJV0LUyIl1pn8e\nZt77TTa+6P0Z+HuN8q40td0eI5AIJVYNcpn5nqCci0A7+qbpMv3yZR8jYoxoe1ta\nVlCGXpQChjtZPGiU4DlbAj1OFBqVmhtR4kSoP2ZoamZXcUCHpGiEGLFqs0m+lmk\nsQosPxRRAgMBAAECggEAAuyle28tmkpCF1UOua4mrHiWhDjZLJOCvwoLhKjdQzeR\nrExo/4EyiuJ2mfw3kf22mjH8k//pOGFqvTVjlRxoNJ7l9kQBTDahTM0OG33DWHXk\nG5hMCOEs6b3cIWs82dgzREBBc1TgQ0WGrf+yFum0coYXJ1keWx9N/RWJ0iI9ygjE\nFbB0qkdDchuhFk+KeS+ndBEA+zc+H6uw6EBzA5+kzCHj/UAdlth012J9/4pqpY6N\nEN1EJPl+Mgy51Y6AiE3ZWRStzpRI/jSDtfaKFA7tXBToSfOVa8xRVOh9bc+6Kjes\nCIt0jYmS/G+ShtI/Huq5M9CAkT3WAnDgZ7kSZnAKhwKBgQDNEPB1kWbHXO2KfoLH\nhomWlbqq80grE/jCgHB6oeZ3tw+GlMMhMzYTGUl4wYn40eoXIz7e9vJoYt+mlPbs\n7APYulSR+9udD7VC+qe91vTEdwekh3cPCqEBrfVWVqWSpb0GupSXtENv1DnzHh/w\nujf9lQtrEZdbYEM5R3T/jZbP0wKBgQDMJ/MsIJgCJM7RHq0wy15T2WVj554NCyfz\nBWzi6EmdIug6y20dUivS9A44pGaIIhRfeyAa+Xr5A4z4maDc32F8qLadaIFQAj7Z\ntm00Cdnsr7oIl52pDzFSX/mK7lGBbgkI6lS5pMXH+J3bmmUA3h/nrlRPwSSPuh6E\nzP7/NdGYywKBgEucB00SA3dWiC8cXlP7AxgGtQD7GoznnDz65n4Q280gLhVNHHVN\nUI7SMAjaM2kO3OUTFcdX/iEG87eUDUdl7jUm3q/E0UCj3g2IJfkVHMKjsKm1WOyu\n2pan8WGYKQxdF8k3WjplOMgu0/8UCGrV/nb9UWx02/3RDHg+JKFlL0oJAoGAaQ+O\nBoFneIL0o41D1z5w9nmDwdvp7BB3qIp8NHERoPnbxJX3OwWUY+UQhHmmAhx3m4ND\nTF5iuE7pdu2oaMHT61DvWSX0lfXx3hwRKpx/N1xfQhi0G9IjsZ6OTr7B1veHUr00\niKyQ043Pvrk/jSjCBnoiDUD5zbUcC39rIm7Rw+0CgYB5EIIQSItZw8L1sfyaxrg2\nxwg7blo02PQPst4TXJZGHl9sJ++AjC8i91CxPiT6b9SORvSYz6EF1n2jwWE10Oje\nWE72jdF9p3bHgsM42wwjriMa2Q/fZsld1vgxxKgvmjuoyOpES7E2CZN17QJtpIVw\ndZ5RNSOxwPCUBG4KXKNbMQ==\n-----END PRIVATE KEY-----\n`,
  "client_email": "firebase-adminsdk-fbsvc@cotao-online.iam.gserviceaccount.com",
  "client_id": "107806752885228224052",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40cotao-online.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
} as ServiceAccount;
