import Purchases, {
  type PurchasesPackage,
  type CustomerInfo,
  type PurchasesOffering,
} from "react-native-purchases";
import { Platform } from "react-native";

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";

export function configurePurchases(userId: string) {
  const apiKey = Platform.select({ ios: IOS_KEY, android: ANDROID_KEY, default: "" });
  if (!apiKey) return;
  Purchases.configure({ apiKey, appUserID: userId });
}

export async function getOffering(
  tier: "starter" | "pro" | "elite"
): Promise<PurchasesOffering | null> {
  try {
    const { all, current } = await Purchases.getOfferings();
    return all[tier] ?? current;
  } catch {
    return null;
  }
}

export async function purchasePkg(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

export function isPremiumActive(info: CustomerInfo): boolean {
  return Object.keys(info.entitlements.active).length > 0;
}
