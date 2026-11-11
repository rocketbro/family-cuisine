import { BrowserRouter, Route, Routes } from 'react-router';
import { DictationProvider } from './dictation/DictationProvider.tsx';
import { useEdgeSwipeBack } from './navigation/useEdgeSwipeBack.ts';
import { useNavMemory } from './navigation/useNavMemory.ts';
import { CheckinScreen } from './screens/CheckinScreen.tsx';
import { DayScreen } from './screens/DayScreen.tsx';
import { ImportScreen } from './screens/ImportScreen.tsx';
import { PlanImportScreen } from './screens/PlanImportScreen.tsx';
import { PantryScreen } from './screens/PantryScreen.tsx';
import { RecipeScreen } from './screens/RecipeScreen.tsx';
import { RecipesScreen } from './screens/RecipesScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
import { ReceiptScreen } from './screens/ReceiptScreen.tsx';
import { ShopScreen } from './screens/ShopScreen.tsx';
import { WeekScreen } from './screens/WeekScreen.tsx';
import { AvoidedMealsScreen } from './screens/settings/AvoidedMealsScreen.tsx';
import { CookingScreen } from './screens/settings/CookingScreen.tsx';
import { HouseholdScreen } from './screens/settings/HouseholdScreen.tsx';
import { NotificationsScreen } from './screens/settings/NotificationsScreen.tsx';
import { PlanningScreen } from './screens/settings/PlanningScreen.tsx';
import { TripCheckScreen } from './screens/shop/TripCheckScreen.tsx';
import { ShoppingScreen } from './screens/settings/shopping/ShoppingScreen.tsx';
import { StockGoalScreen } from './screens/settings/stock-up/StockGoalScreen.tsx';
import { StockPickerScreen } from './screens/settings/stock-up/StockPickerScreen.tsx';
import { StockUpScreen } from './screens/settings/stock-up/StockUpScreen.tsx';
import { OnboardingHost } from './onboarding/OnboardingHost.tsx';
import { Nav } from './ui/Nav.tsx';

export function App() {
  return (
    <BrowserRouter>
      <DictationProvider>
        <Shell />
      </DictationProvider>
    </BrowserRouter>
  );
}

function Shell() {
  useNavMemory();
  useEdgeSwipeBack();
  return (
    <div className="shell">
      <Nav />
      <OnboardingHost />
      <main>
        <Routes>
          <Route path="/" element={<DayScreen />} />
          <Route path="/day/:date" element={<DayScreen />} />
          <Route path="/week" element={<WeekScreen />} />
          <Route path="/week/import" element={<PlanImportScreen />} />
          <Route path="/recipes" element={<RecipesScreen />} />
          <Route path="/recipes/import" element={<ImportScreen />} />
          <Route path="/recipes/:slug" element={<RecipeScreen />} />
          <Route path="/pantry" element={<PantryScreen />} />
          <Route path="/shop" element={<ShopScreen />} />
          <Route path="/shop/trip/:date" element={<TripCheckScreen />} />
          <Route path="/shop/receipts/:id" element={<ReceiptScreen />} />
          <Route path="/checkin/:date" element={<CheckinScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/settings/household" element={<HouseholdScreen />} />
          <Route path="/settings/shopping" element={<ShoppingScreen />} />
          <Route path="/settings/planning" element={<PlanningScreen />} />
          <Route path="/settings/cooking" element={<CookingScreen />} />
          <Route path="/settings/stock-up" element={<StockUpScreen />} />
          <Route path="/settings/stock-up/add" element={<StockPickerScreen />} />
          <Route path="/settings/stock-up/:itemId" element={<StockGoalScreen />} />
          <Route path="/settings/avoided" element={<AvoidedMealsScreen />} />
          <Route path="/settings/notifications" element={<NotificationsScreen />} />
        </Routes>
      </main>
    </div>
  );
}
