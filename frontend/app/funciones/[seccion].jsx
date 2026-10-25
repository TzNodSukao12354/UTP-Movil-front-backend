import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import { useBottomNav } from "../../hooks/useBottomNav";

const sections = {
  eventos: {
    title: "Eventos",
    description: "Aquí podrás descubrir actividades de la comunidad UTP y ver sus detalles.",
    icon: "calendar-outline",
    color: "#A78BFA",
  },
  notificaciones: {
    title: "Notificaciones",
    description: "Aquí aparecerán avisos sobre tu cuenta y las novedades de la comunidad.",
    icon: "notifications-outline",
    color: "#FBBF24",
  },
  amigos: {
    title: "Amigos",
    description: "Aquí podrás encontrar estudiantes y conectar con tus amigos.",
    icon: "people-outline",
    color: "#60A5FA",
  },
};

export default function PreviewSection({ sectionOverride, isTab = false }) {
  const router = useRouter();
  const { seccion: routeSection } = useLocalSearchParams();
  const { paddingBottom } = useBottomNav();
  const seccion = sectionOverride || routeSection;
  const section = sections[seccion] || sections.eventos;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#050505", paddingBottom: isTab ? 0 : paddingBottom }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14 }}>
        {!isTab && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Volver a Inicio"
            onPress={() => router.back()}
            style={{ padding: 8, marginRight: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        )}
        <Text style={{ color: "white", fontSize: 20, fontWeight: "800" }}>{section.title}</Text>
      </View>

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
        <View style={{
          width: 76,
          height: 76,
          borderRadius: 24,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${section.color}24`,
        }}>
          <Ionicons name={section.icon} size={38} color={section.color} />
        </View>
        <Text style={{ color: "white", fontSize: 21, fontWeight: "700", textAlign: "center", marginTop: 22 }}>
          {section.title} en preparación
        </Text>
        <Text style={{ color: "#aaa", fontSize: 15, lineHeight: 23, textAlign: "center", marginTop: 10 }}>
          {section.description}
        </Text>
        <View style={{ marginTop: 20, borderRadius: 18, backgroundColor: "#171717", paddingHorizontal: 14, paddingVertical: 9 }}>
          <Text style={{ color: "#ccc", fontSize: 12, fontWeight: "600" }}>
            Vista previa · No se guarda información
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
