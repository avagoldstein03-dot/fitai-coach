# FitAI Coach - Mobile App (React Native/Expo)

Production-ready fitness coaching mobile application built with React Native and Expo.

## Project Structure

```
frontend/
├── screens/
│   ├── auth/                 # Authentication screens
│   ├── onboarding/           # 8-step onboarding flow
│   ├── dashboard/            # Main dashboard
│   ├── assessment/           # Body scan assessment
│   ├── food/                 # Food scanner
│   ├── workouts/             # Workout programs
│   ├── nutrition/            # Nutrition planning
│   ├── coach/                # AI coach chat
│   └── profile/              # User profile
├── navigation/
│   ├── RootNavigator.tsx     # Main navigation stack
│   └── OnboardingNavigator.tsx # Onboarding flow
├── components/               # Reusable components
├── services/                 # API services
├── store/                    # Zustand state management
├── types/                    # TypeScript definitions
├── App.tsx                   # Root app component
├── app.json                  # Expo configuration
└── package.json              # Dependencies
```

## Features

✅ Clerk Authentication
✅ 8-step Onboarding Flow
✅ Body Scan with Camera
✅ Food Recognition Scanner
✅ Workout Tracking
✅ Nutrition Dashboard
✅ AI Coach Chat
✅ Progress Tracking
✅ User Profile Management

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **State Management**: Zustand / React Query
- **Navigation**: React Navigation
- **Authentication**: Clerk
- **API Client**: Axios
- **Forms**: React Hook Form (can be added)

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Xcode (for iOS) or Android Studio (for Android)

### Installation

```bash
# Install dependencies
npm install

# Start development
npm run dev

# On iOS
npm run dev
# Scan QR code with Camera app or Expo app

# On Android
npm run dev
# Scan QR code with Expo app
```

### Building

```bash
# iOS
npm run build:ios

# Android
npm run build:android

# Web
npm run web
```

## Authentication Flow

1. User signs up/signs in with Clerk
2. Redirects to onboarding if new user
3. 8-step onboarding flow:
   - Step 1: Basic info (name, age, sex, height, weight)
   - Step 2: Fitness goal selection
   - Step 3: Activity level
   - Step 4: Fitness experience
   - Step 5: Diet preferences
   - Step 6: Food allergies
   - Step 7: Supplement history
   - Step 8: Assessment method selection
4. Redirects to main app dashboard

## Screens

### Authentication
- **SignInScreen**: Email/password login
- **SignUpScreen**: Create new account

### Onboarding (8 Steps)
- **Step1Screen**: Basic info collection
- **Step2Screen**: Goal selection
- **Step3Screen**: Activity level
- **Step4Screen**: Fitness experience
- **Step5Screen**: Diet preferences
- **Step6Screen**: Food allergies
- **Step7Screen**: Supplement history
- **Step8Screen**: Assessment method

### Main App
- **DashboardScreen**: Overview & quick actions
- **BodyScanScreen**: Photo-based assessment
- **FoodScannerScreen**: Meal photo scanning
- **WorkoutsScreen**: Workout programs & logging
- **NutritionScreen**: Daily nutrition targets
- **CoachChatScreen**: AI coach conversation
- **ProfileScreen**: User profile & settings

## API Integration

All API calls go through the backend:
- Base URL: `process.env.EXPO_PUBLIC_API_URL`
- Authentication: Clerk JWT tokens (automatic)
- All calls require user authentication

### Key Endpoints Used

- `POST /api/auth/profile` - Get user profile
- `POST /api/onboarding/step{1-8}` - Onboarding endpoints
- `POST /api/assessment/*` - Body assessment
- `POST /api/food/*` - Food scanning
- `POST /api/nutrition/*` - Nutrition planning
- `POST /api/workouts/*` - Workout programs
- `POST /api/chat/*` - AI coach

## Camera & Image Permissions

The app requests permissions for:
- Camera access (for body scans and food photos)
- Photo library access (for image selection)

Permissions are requested at runtime using Expo APIs.

## State Management

Using React Query for server state and can add Zustand for client state:

```typescript
// Example: Using React Query
const { data: profile, isLoading } = useQuery({
  queryKey: ["profile"],
  queryFn: () => fetchProfile(),
});
```

## Environment Variables

See `../.env.example`:
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_POSTHOG_API_KEY`

## Styling

Using NativeWind with Tailwind CSS utilities:

```tsx
<View className="bg-gray-900 px-6 py-8">
  <Text className="text-3xl font-bold text-white">Hello</Text>
</View>
```

## Development Tips

1. Use Expo Go app for quick testing
2. Enable fast refresh for instant updates
3. Use TypeScript for type safety
4. Test on both iOS and Android
5. Use React DevTools for debugging

## Deployment

### Apple App Store
```bash
npm run build:ios
# Follow EAS Build & TestFlight instructions
```

### Google Play Store
```bash
npm run build:android
# Follow EAS Build & Play Store instructions
```

## Performance Optimization

- Code splitting with React Navigation
- Image optimization with Expo Image
- Lazy loading of screens
- Query caching with React Query
- Memoization of expensive components

## Known Limitations

- Currently works on iOS and Android
- Web support is experimental
- Some native features require EAS builds

## Support

For issues and questions, refer to:
- [Expo Documentation](https://docs.expo.dev)
- [React Native Docs](https://reactnative.dev)
- [React Navigation Docs](https://reactnavigation.org)
