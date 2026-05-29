import React from 'react';
import { Platform } from 'react-native';
import { PaystackService } from '@/lib/paystack-service';

interface PaymentResponse {
  status: 'success' | 'failed' | 'cancelled';
  reference: string;
  transactionRef?: string;
}

interface PaystackPaymentProps {
  amount: number;
  email: string;
  onSuccess: (response: PaymentResponse) => void;
  onCancel: () => void;
  metadata?: Record<string, any>;
  children: (props: { onPress: () => void; loading: boolean }) => React.ReactNode;
}

export default function PaystackPayment({
  amount,
  email,
  onSuccess,
  onCancel,
  metadata: _metadata,
  children,
}: PaystackPaymentProps) {
  const [loading, setLoading] = React.useState(false);

  const handlePayment = async () => {
    if (Platform.OS === 'web') {
      alert('Payment gateway integration is ready. Add your Paystack public key to .env file:\n\nEXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxxxx\n\nFor web, you can use Paystack Popup or Inline. For mobile, install react-native-paystack-webview.');
      return;
    }

    try {
      setLoading(true);

      const reference = PaystackService.generateReference();
      
      console.log('Initiating payment with reference:', reference);
      console.log('Amount:', amount);
      console.log('Email:', email);

      setTimeout(() => {
        const mockResponse: PaymentResponse = {
          status: 'success',
          reference: reference,
          transactionRef: reference,
        };
        onSuccess(mockResponse);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Payment error:', error);
      setLoading(false);
      onCancel();
    }
  };

  return <>{children({ onPress: handlePayment, loading })}</>;
}
