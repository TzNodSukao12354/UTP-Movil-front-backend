import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFeed } from "../context/FeedContext";
import { formatRelativeTime } from "../utils/time";

function ShortVideo({ post, width, height, bottomInset, active, onOpenOptions }) {
  const player = useVideoPlayer(post.mediaUrl, (instance) => {
    instance.loop = true;
    instance.timeUpdateEventInterval = 0.25;
  });
  const mediaWidth = Number(post.mediaWidth) || 16;
  const mediaHeight = Number(post.mediaHeight) || 9;
  const scale = Math.min(width / mediaWidth, height / mediaHeight);
  const videoWidth = mediaWidth * scale;
  const videoHeight = mediaHeight * scale;
  const [playback, setPlayback] = useState({ currentTime: 0, duration: 0, playing: false });
  const [progressWidth, setProgressWidth] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const isFastForwardingRef = useRef(false);
  const longPressTriggeredRef = useRef(false);

  useEffect(() => {
    const timeSubscription = player.addListener("timeUpdate", ({ currentTime }) => {
      setPlayback((previous) => ({
        ...previous,
        currentTime,
        duration: player.duration || previous.duration,
      }));
    });
    const playingSubscription = player.addListener("playingChange", ({ isPlaying }) => {
      setPlayback((previous) => ({ ...previous, playing: isPlaying }));
    });

    return () => {
      timeSubscription.remove();
      playingSubscription.remove();
    };
  }, [player]);

  useEffect(() => {
    if (active) {
      player.play();
      setPlayback((previous) => ({
        ...previous,
        currentTime: player.currentTime,
        duration: player.duration || previous.duration,
        playing: player.playing,
      }));
    } else {
      player.pause();
      player.playbackRate = 1;
      isFastForwardingRef.current = false;
      longPressTriggeredRef.current = false;
      setIsFastForwarding(false);
    }
  }, [active, player]);

  useEffect(() => {
    if (!active || !playback.playing) {
      setControlsVisible(true);
      return undefined;
    }
    if (!controlsVisible) return undefined;

    const timeout = setTimeout(() => setControlsVisible(false), 850);
    return () => clearTimeout(timeout);
  }, [active, controlsVisible, playback.playing]);

  useEffect(() => {
    Animated.timing(controlsOpacity, {
      toValue: controlsVisible ? 1 : 0,
      duration: controlsVisible ? 120 : 250,
      useNativeDriver: true,
    }).start();
  }, [controlsOpacity, controlsVisible]);

  const username = post.usuario || "Estudiante UTP";
  const voteCount = Number(post.likes) || 0;
  const duration = playback.duration || player.duration || 0;
  const progress = duration > 0 ? Math.min(playback.currentTime / duration, 1) : 0;

  const formatTime = (seconds) => {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
  };

  const seekToPosition = (locationX) => {
    if (!duration || !progressWidth) return;
    const position = Math.max(0, Math.min(locationX, progressWidth)) / progressWidth;
    const currentTime = position * duration;
    player.currentTime = currentTime;
    setPlayback((previous) => ({ ...previous, currentTime, duration }));
  };

  return (
    <View style={{ height, backgroundColor: "#000" }}>
      <VideoView
        player={player}
        style={{
          position: "absolute",
          left: (width - videoWidth) / 2,
          top: (height - videoHeight) / 2,
          width: videoWidth,
          height: videoHeight,
        }}
        contentFit="contain"
        nativeControls={false}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pausar o reproducir el video; mantén presionado para velocidad doble"
        delayLongPress={3000}
        onPress={() => {
          if (longPressTriggeredRef.current) {
            longPressTriggeredRef.current = false;
            return;
          }
          setControlsVisible(true);
          if (player.playing) {
            player.pause();
          } else {
            player.play();
          }
        }}
        onLongPress={() => {
          if (player.playing) {
            longPressTriggeredRef.current = true;
            isFastForwardingRef.current = true;
            player.playbackRate = 2;
            setIsFastForwarding(true);
          }
        }}
        onPressOut={() => {
          if (isFastForwardingRef.current) {
            isFastForwardingRef.current = false;
            player.playbackRate = 1;
            setIsFastForwarding(false);
          }
        }}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
      />

      <Animated.View
        pointerEvents={controlsVisible ? "box-none" : "none"}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
          opacity: controlsOpacity,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 30 }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Retroceder 10 segundos"
            onPress={() => player.seekBy(-10)}
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <MaterialIcons name="replay-10" size={34} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={playback.playing ? "Pausar video" : "Reproducir video"}
            onPress={() => {
              setControlsVisible(true);
              if (player.playing) {
                player.pause();
              } else {
                player.play();
              }
            }}
            style={{ width: 68, height: 68, alignItems: "center", justifyContent: "center", borderRadius: 34, backgroundColor: "rgba(0,0,0,0.6)" }}
          >
            <Ionicons name={playback.playing ? "pause" : "play"} size={34} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Avanzar 10 segundos"
            onPress={() => player.seekBy(10)}
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <MaterialIcons name="forward-10" size={34} color="white" />
          </TouchableOpacity>
        </View>
      </Animated.View>
      {isFastForwarding && (
        <View pointerEvents="none" style={{ position: "absolute", top: "58%", alignSelf: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.65)" }}>
          <Text style={{ color: "white", fontSize: 14, fontWeight: "700" }}>2×</Text>
        </View>
      )}

      <View style={{ position: "absolute", right: 14, bottom: bottomInset + 8, alignItems: "center" }}>
        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <Ionicons
            name={post.userVote === "up" ? "heart" : "heart-outline"}
            size={34}
            color={post.userVote === "up" ? "#E60023" : "white"}
          />
          <Text style={{ color: "white", fontWeight: "700", marginTop: 4 }}>{voteCount}</Text>
        </View>

        <View style={{ alignItems: "center" }}>
          <Ionicons name="chatbubble-ellipses-outline" size={32} color="white" />
          <Text style={{ color: "white", fontWeight: "700", marginTop: 4 }}>
            {post.comments?.length || 0}
          </Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Opciones del Short"
          onPress={onOpenOptions}
          style={{ alignItems: "center", marginTop: 12, padding: 4 }}
        >
          <Ionicons name="ellipsis-horizontal" size={30} color="white" />
        </TouchableOpacity>
      </View>

      <View style={{ position: "absolute", left: 18, right: 84, bottom: bottomInset + 42 }}>
        <Text style={{ color: "white", fontSize: 17, fontWeight: "700", textShadowColor: "#000", textShadowRadius: 5 }}>
          @{username}
        </Text>
        {!!post.texto && (
          <Text
            numberOfLines={3}
            style={{ color: "white", fontSize: 15, marginTop: 8, textShadowColor: "#000", textShadowRadius: 5 }}
          >
            {post.texto}
          </Text>
        )}
        <Text style={{ color: "#eee", fontSize: 12, marginTop: 8, textShadowColor: "#000", textShadowRadius: 5 }}>
          {formatRelativeTime(post.createdAt)}
        </Text>
      </View>

      <View style={{ position: "absolute", left: 18, right: 78, bottom: bottomInset + 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: "white", fontSize: 11, fontVariant: ["tabular-nums"] }}>
          {formatTime(playback.currentTime)}
        </Text>
        <View
          onLayout={(event) => setProgressWidth(event.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(event) => seekToPosition(event.nativeEvent.locationX)}
          onResponderMove={(event) => seekToPosition(event.nativeEvent.locationX)}
          accessibilityRole="adjustable"
          accessibilityLabel="Progreso del video"
          accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(playback.currentTime) }}
          style={{ height: 24, flex: 1, justifyContent: "center" }}
        >
          <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.45)", overflow: "visible" }}>
            <View style={{ width: `${progress * 100}%`, height: 4, borderRadius: 2, backgroundColor: "#fff" }} />
            <View style={{ position: "absolute", left: `${progress * 100}%`, top: -4, width: 12, height: 12, marginLeft: -6, borderRadius: 6, backgroundColor: "#fff" }} />
          </View>
        </View>
        <Text style={{ color: "white", fontSize: 11, fontVariant: ["tabular-nums"] }}>
          {formatTime(duration)}
        </Text>
      </View>
    </View>
  );
}

export default function ShortsScreen({ isTab = false, isTabActive = true }) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { posts, loading, error, loadPosts, savedPostIds, hiddenUsers, toggleSavedPost, reportPost, hideUser } = useFeed();
  const playerBottomInset = insets.bottom + (isTab ? 8 : 0);
  const isPlaybackActive = isFocused && (!isTab || isTabActive);
  const [pageHeight, setPageHeight] = useState(windowHeight);
  const [activePostId, setActivePostId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);

  const shorts = useMemo(
    () => posts.filter((post) => (
      post.mediaType === "video"
      && post.mediaUrl
      && !hiddenUsers.has(String(post.authorId))
    )),
    [hiddenUsers, posts],
  );
  const activePost = shorts.find((post) => String(post.id) === activePostId);
  const activePostIsSaved = activePost && savedPostIds.some(
    (id) => String(id) === String(activePost.id),
  );

  useEffect(() => {
    if (shorts.length && !shorts.some((post) => String(post.id) === activePostId)) {
      setActivePostId(String(shorts[0].id));
    }
  }, [activePostId, shorts]);

  useEffect(() => {
    if (!isPlaybackActive) setActivePostId(null);
  }, [isPlaybackActive]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPosts({ silent: true });
    } catch {
      // FeedContext keeps the request error for the empty state.
    } finally {
      setRefreshing(false);
    }
  }, [loadPosts]);

  useEffect(() => {
    if (isPlaybackActive) refresh();
  }, [isPlaybackActive, refresh]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const visible = viewableItems.find((item) => item.isViewable);
    setActivePostId(visible ? String(visible.item.id) : null);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const handleSave = async () => {
    if (!activePost) return;
    try {
      await toggleSavedPost(activePost.id);
      setOptionsVisible(false);
    } catch (saveError) {
      Alert.alert("No se pudo guardar", saveError.message);
    }
  };

  const handleReport = () => {
    if (!activePost || activePost.reported) return;
    Alert.alert("Denunciar publicación", "¿Quieres denunciar este Short para que se revise?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Denunciar",
        style: "destructive",
        onPress: async () => {
          try {
            await reportPost(activePost.id);
            setOptionsVisible(false);
            Alert.alert("Denuncia registrada", "La publicación fue enviada para revisión.");
          } catch (reportError) {
            Alert.alert("No se pudo denunciar", reportError.message);
          }
        },
      },
    ]);
  };

  const handleHideUser = async () => {
    if (!activePost) return;
    const username = String(activePost.usuario || "Estudiante UTP");
    try {
      await hideUser(activePost.authorId);
      setOptionsVisible(false);
      setActivePostId(null);
      Alert.alert("Publicaciones ocultas", `Ya no verás publicaciones de ${username}.`);
    } catch (hideError) {
      Alert.alert("No se pudo ocultar al usuario", hideError.message);
    }
  };

  const renderItem = useCallback(({ item }) => (
    <ShortVideo
      post={item}
      width={windowWidth}
      height={pageHeight}
      bottomInset={playerBottomInset}
      active={isPlaybackActive && String(item.id) === activePostId}
      onOpenOptions={() => setOptionsVisible(true)}
    />
  ), [activePostId, isPlaybackActive, pageHeight, playerBottomInset, windowWidth]);

  if (!isTab) return <Redirect href={{ pathname: "/inicio/inicio", params: { tab: "shorts" } }} />;

  return (
    <View
      onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}
      style={{ flex: 1, backgroundColor: "#000" }}
    >
      <StatusBar barStyle="light-content" />
      <FlatList
        data={shorts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        extraData={activePostId}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        onRefresh={refresh}
        refreshing={refreshing}
        getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
        ListEmptyComponent={(
          <View style={{ height: pageHeight, alignItems: "center", justifyContent: "center", padding: 28 }}>
            {loading || refreshing ? (
              <ActivityIndicator color="#E60023" size="large" />
            ) : (
              <>
                <Ionicons name="videocam-outline" size={52} color="#E60023" />
                <Text style={{ color: "white", fontSize: 20, fontWeight: "700", marginTop: 16 }}>
                  {hiddenUsers.size ? "No hay más Shorts para mostrar" : error ? "No se pudieron cargar los Shorts" : "Todavía no hay Shorts"}
                </Text>
                <Text style={{ color: "#aaa", textAlign: "center", marginTop: 8, lineHeight: 21 }}>
                  {hiddenUsers.size
                    ? "Ocultaste las publicaciones de algunos usuarios."
                    : error || "Publica un video para que aparezca aquí. Los videos publicados en el feed también se muestran en esta sección."}
                </Text>
                {!hiddenUsers.size && (
                  <TouchableOpacity
                    onPress={error ? refresh : () => router.push("/inicio/crearpublicacion")}
                    style={{ backgroundColor: "#E60023", borderRadius: 22, paddingHorizontal: 20, paddingVertical: 11, marginTop: 20 }}
                  >
                    <Text style={{ color: "white", fontWeight: "700" }}>
                      {error ? "Reintentar" : "Crear publicación"}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}
      />

      {isTab && <View style={{ position: "absolute", top: insets.top + 10, left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "white", fontSize: 18, fontWeight: "800", textShadowColor: "#000", textShadowRadius: 5 }}>
          SHORTS · SOLO LECTURA
        </Text>
      </View>}

      <Modal
        visible={optionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionsVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setOptionsVisible(false)}
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.65)" }}
        >
          <View style={{ backgroundColor: "#151515", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 18 }}>
            <View style={{ width: 42, height: 4, borderRadius: 2, backgroundColor: "#555", alignSelf: "center", marginBottom: 14 }} />
            <Text style={{ color: "white", fontSize: 16, fontWeight: "700", marginBottom: 8 }}>
              Opciones del Short
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleSave}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16, gap: 14 }}
            >
              <Ionicons name={activePostIsSaved ? "bookmark" : "bookmark-outline"} size={23} color="white" />
              <Text style={{ color: "white", fontSize: 15 }}>{activePostIsSaved ? "Quitar de guardados" : "Guardar en perfil"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={activePost?.reported}
              onPress={handleReport}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16, gap: 14, opacity: activePost?.reported ? 0.55 : 1 }}
            >
              <Ionicons name="flag-outline" size={23} color="#ff6b6b" />
              <Text style={{ color: "#ff6b6b", fontSize: 15 }}>{activePost?.reported ? "Ya denunciaste esta publicación" : "Denunciar publicación"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleHideUser}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 16, gap: 14 }}
            >
              <Ionicons name="eye-off-outline" size={23} color="white" />
              <Text style={{ color: "white", fontSize: 15, flexShrink: 1 }}>
                Dejar de ver publicaciones de {activePost?.usuario || "este usuario"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setOptionsVisible(false)}
              style={{ alignItems: "center", paddingVertical: 14, marginTop: 4, borderTopWidth: 1, borderTopColor: "#333" }}
            >
              <Text style={{ color: "#aaa", fontWeight: "700" }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
