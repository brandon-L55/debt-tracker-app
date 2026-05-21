import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function AuthLayout() {
  const { session, isLoading } = useAuth();

  // While auth is loading, render nothing (root layout shows spinner)
  if (isLoading) return null;

  // Already authenticated — skip auth screens
  if (session) return <Redirect href="/(tabs)" />;

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
