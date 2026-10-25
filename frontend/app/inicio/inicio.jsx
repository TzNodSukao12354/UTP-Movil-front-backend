import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useBottomNav } from "../../hooks/useBottomNav";
import Perfil from "../perfil/perfil";
import styles from "./cssinicio";
import InicioFeed from "./InicioFeed";
import ShortsScreen from "../shorts";
import PreviewSection from "../funciones/[seccion]";
import Chat from "../chat/chat";

const LINE_WIDTH = 40; // Ancho de la línea roja

export default function Inicio() {
  const { width: screenWidth } = useWindowDimensions();
  const tabWidth = screenWidth / 5;
  const { tab } = useLocalSearchParams();
  const initialTabIndex = tab === "shorts" ? 1 : 0;
  const scrollViewRef = useRef(null);
  const initialTabScrollRef = useRef(initialTabIndex > 0);
  const [activeTab, setActiveTab] = useState(initialTabIndex);
  const [pagerHeight, setPagerHeight] = useState(0);
  const { paddingBottom } = useBottomNav();
  const isScrollingRef = useRef(false);

  // Animación para la línea indicadora
  const slideAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (initialTabScrollRef.current) {
      scrollViewRef.current?.scrollTo({ x: initialTabIndex * screenWidth, animated: false });
      initialTabScrollRef.current = false;
    }
  }, [initialTabIndex, screenWidth]);

  useEffect(() => {
    // Animar la línea cuando cambia el tab
    Animated.spring(slideAnimation, {
      toValue: activeTab,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [activeTab, slideAnimation]);

  const goToTab = (index) => {
    setActiveTab(index);
    isScrollingRef.current = true;
    scrollViewRef.current?.scrollTo({ x: index * screenWidth, animated: true });
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 350);
  };

  const handleScroll = (event) => {
    if (isScrollingRef.current) return;
    const xOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(xOffset / screenWidth);
    if (index !== activeTab && index >= 0 && index < 5) {
      setActiveTab(index);
    }
  };

  // Calcular posición X de la línea (centrada en cada tab)
  const linePosition = slideAnimation.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: [
      tabWidth / 2 - LINE_WIDTH / 2, // Tab 0: Inicio
      tabWidth + tabWidth / 2 - LINE_WIDTH / 2, // Tab 1: Shorts
      tabWidth * 2 + tabWidth / 2 - LINE_WIDTH / 2, // Tab 2: Amigos
      tabWidth * 3 + tabWidth / 2 - LINE_WIDTH / 2, // Tab 3: Notificaciones
      tabWidth * 4 + tabWidth / 2 - LINE_WIDTH / 2, // Tab 4: Perfil
    ],
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#050505" }}>
      {/* Paging Horizontal Content */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onLayout={(event) => setPagerHeight(event.nativeEvent.layout.height)}
        scrollEventThrottle={16}
        bounces={false}
        style={{ flex: 1 }}
      >
        <View style={{ width: screenWidth, height: pagerHeight || "100%" }}>
          <InicioFeed isTab={true} />
        </View>
        <View style={{ width: screenWidth, height: pagerHeight || "100%" }}>
          <ShortsScreen isTab={true} isTabActive={activeTab === 1} />
        </View>
        <View style={{ width: screenWidth, height: pagerHeight || "100%" }}>
          <Chat isTab={true} onGoToTab={goToTab} />
        </View>
        <View style={{ width: screenWidth, height: pagerHeight || "100%" }}>
          <PreviewSection sectionOverride="notificaciones" isTab={true} />
        </View>
        <View style={{ width: screenWidth, height: pagerHeight || "100%" }}>
          <Perfil isTab={true} onGoToTab={goToTab} />
        </View>
      </ScrollView>

      {/* GLOBAL BOTTOM NAVIGATION BAR */}
      <View style={[styles.bottomNav, { paddingBottom }]}>
        {/* Línea animada que se desliza */}
        <Animated.View
          style={[
            styles.activeLine,
            {
              transform: [{ translateX: linePosition }],
            },
          ]}
        />

        {/* INICIO TAB */}
        <TouchableOpacity style={styles.navItem} onPress={() => goToTab(0)}>
          <Ionicons
            name={activeTab === 0 ? "home" : "home-outline"}
            size={26}
            color={activeTab === 0 ? "#E60023" : "#888"}
          />
          <Text
            style={[styles.navText, activeTab === 0 && styles.navTextActive]}
          >
            Inicio
          </Text>
        </TouchableOpacity>

        {/* SHORTS TAB */}
        <TouchableOpacity style={styles.navItem} onPress={() => goToTab(1)}>
          <Ionicons
            name={activeTab === 1 ? "play-circle" : "play-circle-outline"}
            size={26}
            color={activeTab === 1 ? "#E60023" : "#888"}
          />
          <Text style={[styles.navText, activeTab === 1 && styles.navTextActive]}>
            Shorts
          </Text>
        </TouchableOpacity>

        {/* CHAT TAB */}
        <TouchableOpacity style={styles.navItem} onPress={() => goToTab(2)}>
          <Ionicons
            name={activeTab === 2 ? "chatbubbles" : "chatbubbles-outline"}
            size={26}
            color={activeTab === 2 ? "#E60023" : "#888"}
          />
          <Text
            style={[styles.navText, activeTab === 2 && styles.navTextActive]}
          >
            Chat
          </Text>
        </TouchableOpacity>

        {/* NOTIFICATIONS TAB */}
        <TouchableOpacity style={styles.navItem} onPress={() => goToTab(3)}>
          <Ionicons
            name={activeTab === 3 ? "notifications" : "notifications-outline"}
            size={26}
            color={activeTab === 3 ? "#E60023" : "#888"}
          />
          <Text style={[styles.navText, activeTab === 3 && styles.navTextActive]}>
            Notificaciones
          </Text>
        </TouchableOpacity>

        {/* PERFIL TAB */}
        <TouchableOpacity style={styles.navItem} onPress={() => goToTab(4)}>
          <Ionicons
            name={activeTab === 4 ? "person" : "person-outline"}
            size={26}
            color={activeTab === 4 ? "#E60023" : "#888"}
          />
          <Text
            style={[styles.navText, activeTab === 4 && styles.navTextActive]}
          >
            Perfil
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
