-- Create update timestamp function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- GoodOkCoin cryptocurrency wallet system
CREATE TABLE public.user_wallets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance DECIMAL(18, 8) NOT NULL DEFAULT 100.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

-- Transaction history
CREATE TABLE public.coin_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(18, 8) NOT NULL CHECK (amount > 0),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Digital ID - Biometric data (WebAuthn credentials)
CREATE TABLE public.biometric_credentials (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL,
    credential_type TEXT NOT NULL CHECK (credential_type IN ('fingerprint', 'face')),
    public_key TEXT NOT NULL,
    device_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(credential_id)
);

-- Digital signatures / certificates
CREATE TABLE public.digital_certificates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    certificate_name TEXT NOT NULL,
    certificate_data TEXT NOT NULL,
    issuer TEXT,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User documents for signing
CREATE TABLE public.user_documents (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    document_url TEXT NOT NULL,
    document_type TEXT,
    document_size BIGINT,
    is_signed BOOLEAN NOT NULL DEFAULT false,
    signed_at TIMESTAMP WITH TIME ZONE,
    signed_by_certificate_id UUID REFERENCES public.digital_certificates(id),
    signature_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biometric_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_wallets
CREATE POLICY "Users can view their own wallet"
ON public.user_wallets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert wallets"
ON public.user_wallets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet"
ON public.user_wallets FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for coin_transactions
CREATE POLICY "Users can view their transactions"
ON public.coin_transactions FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create transactions"
ON public.coin_transactions FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- RLS Policies for biometric_credentials
CREATE POLICY "Users can view their biometrics"
ON public.biometric_credentials FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their biometrics"
ON public.biometric_credentials FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their biometrics"
ON public.biometric_credentials FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their biometrics"
ON public.biometric_credentials FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for digital_certificates
CREATE POLICY "Users can view their certificates"
ON public.digital_certificates FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their certificates"
ON public.digital_certificates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their certificates"
ON public.digital_certificates FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their certificates"
ON public.digital_certificates FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for user_documents
CREATE POLICY "Users can view their documents"
ON public.user_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their documents"
ON public.user_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their documents"
ON public.user_documents FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their documents"
ON public.user_documents FOR DELETE
USING (auth.uid() = user_id);

-- Function to transfer coins
CREATE OR REPLACE FUNCTION public.transfer_coins(
    p_receiver_id UUID,
    p_amount DECIMAL(18, 8),
    p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sender_balance DECIMAL(18, 8);
    v_transaction_id UUID;
BEGIN
    SELECT balance INTO v_sender_balance
    FROM user_wallets
    WHERE user_id = auth.uid();
    
    IF v_sender_balance IS NULL THEN
        RAISE EXCEPTION 'Wallet not found';
    END IF;
    
    IF v_sender_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;
    
    UPDATE user_wallets
    SET balance = balance - p_amount, updated_at = now()
    WHERE user_id = auth.uid();
    
    INSERT INTO user_wallets (user_id, balance)
    VALUES (p_receiver_id, p_amount)
    ON CONFLICT (user_id) 
    DO UPDATE SET balance = user_wallets.balance + p_amount, updated_at = now();
    
    INSERT INTO coin_transactions (sender_id, receiver_id, amount, description)
    VALUES (auth.uid(), p_receiver_id, p_amount, p_description)
    RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$;

-- Trigger for wallet updates
CREATE TRIGGER update_user_wallets_updated_at
    BEFORE UPDATE ON public.user_wallets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();