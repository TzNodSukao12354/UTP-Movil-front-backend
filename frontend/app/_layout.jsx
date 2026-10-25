import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ChatProvider } from "../context/ChatContext";
import AppProvider from "../providers/AppProvider"; // ← agrega esta línea


export default function RootLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [nombreUsuario, setNombreUsuario] = useState("Yo");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      AsyncStorage.getItem("userId"),
      AsyncStorage.getItem("nombre_usuario"),
    ]).then(([id, nombre]) => {
      if (cancelled) return;
      setUserId(id);
      setNombreUsuario(nombre || "Yo");
    }).catch((error) => {
      console.error("No se pudo cargar la sesión local:", error);
    });
    return () => { cancelled = true; };
  }, [pathname]);

  useEffect(() => {
    const verificarSesion = async () => {
      try {
        const idSesion = await AsyncStorage.getItem("userId");
        // "/genero" | "/intereses" | "/carrera" | "/usuario": pasos del
        // registro que solo tienen sentido cuando TODAVÍA no hay cuenta.
        const rutasRegistro = ["/cuenta", "/ingresar", "/verificar-correo", "/verificar-codigo", "/crear-cuenta", "/genero", "/intereses", "/carrera", "/usuario", "/olvide-password", "/nueva-password"];
        const esRutaRegistro = rutasRegistro.includes(pathname);

        if (!idSesion && pathname !== "/login" && !esRutaRegistro) {
          router.replace("/login");
        } else if (idSesion && (pathname === "/login" || esRutaRegistro)) {
          // Ya tiene cuenta creada: que no vuelva a pasar por login/registro
          router.replace("/inicio/inicio");
        }
      } catch (error) {
        console.error("Error verificando sesión:", error);
      }
    };
    verificarSesion();
  }, [pathname, router]);

  return (
  <SafeAreaProvider>
    <AppProvider>
      <ChatProvider userId={userId} nombreUsuario={nombreUsuario} sessionRefreshKey={pathname}>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </ChatProvider>
    </AppProvider>
  </SafeAreaProvider>
  );
}
