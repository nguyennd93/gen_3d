import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Button, Alert, TextInput } from 'react-native';
import ModelViewer from '../../components/ModelViewer';
import * as FileSystem from 'expo-file-system';

const TRIPO_API_KEY = 'tsk_t0QMQmzhD_23N5uDjCukHwrWTVu4srL85poatSoLZ5s';

async function generateGlbFromTripo(token: string, onProgress?: (percent: number) => void): Promise<string | null> {
  try {
    console.log("Start Gen3D: ", token);
    const url = 'https://api.tripo3d.ai/v2/openapi/task';

    const data = {
      type: 'image_to_model',
      file: {
        type: 'png',
        file_token: token
      }
    };

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TRIPO_API_KEY}`
      },
      body: JSON.stringify(data)
    };

    const res = await fetch(url, options);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`❌ HTTP ${res.status} - ${text}`);
    }

    const result = await res.json();
    const taskId = result.data?.task_id;
    console.log('Task ID: ', taskId);

    // Step 2: Poll for result
    const maxWait = 120000;
    const pollInterval = 5000;
    let waited = 0;

    while (waited < maxWait) {
      const pollRes = await fetch(`https://api.tripo3d.ai/v2/openapi/task/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TRIPO_API_KEY}`,
        },
      });

      const statusData = await pollRes.json();
      const status = statusData.data?.status;
      const percent = statusData.data?.progress;
      if (onProgress) onProgress(percent);

      if (status === 'success') {
        const glbUrl = statusData.data?.output?.pbr_model;
        console.log('URL: ', glbUrl);
        return glbUrl ?? null;
      }
      else if (status === 'failed') {
        console.error('❌ Generation failed:', statusData);
        return null;
      }

      await new Promise((res) => setTimeout(res, pollInterval));
      waited += pollInterval;
    }

    console.warn('⏰ Timeout waiting for model.');
    return null;
  } catch (err) {
    console.error('🔥 Error generating model:', err);
    return null;
  }
}

export default function TabTwoScreen() {
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<number>(0);
  const [imageUrl, setImageUrl] = useState<string>('https://i.ibb.co/8nByPGX7/test-png.png'); // 🆕

  const uploadFromImageUrl = async (imageUrl: string): Promise<string | null> => {
    try {
      if (!imageUrl) {
        Alert.alert('❌ Vui lòng nhập URL ảnh');
        return null;
      }

      // Bước 2: Tải ảnh về local cache
      const filename = 'downloaded.png';
      const localPath = FileSystem.cacheDirectory + filename;

      // Bước 3: Upload từ file local
      console.log("Image URI: ", imageUrl);
      const downloadRes = await FileSystem.downloadAsync(imageUrl, localPath);

      const formData = new FormData();
      formData.append('file', {
        uri: downloadRes.uri,
        name: filename,
        type: 'image/png',
      } as any);

      const uploadRes = await fetch('https://api.tripo3d.ai/v2/openapi/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TRIPO_API_KEY}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      const json = await uploadRes.json();

      if (!uploadRes.ok) {
        console.error('❌ Upload thất bại:', json);
        Alert.alert('❌ Upload lỗi', JSON.stringify(json));
        return null;
      }

      console.log('✅ Upload thành công:', json);
      return json.data?.image_token;
    } catch (err) {
      console.error('🔥 Lỗi upload:', err);
      Alert.alert('❌ Lỗi khi upload ảnh', String(err));
      return null;
    }
  };

  const handleGenerateModel = async () => {
    setLoading(true);
    setProgress(0);
    const token = await uploadFromImageUrl(imageUrl);
    if (token) {
      const url = await generateGlbFromTripo(token, setProgress);
      setGlbUrl(url);
    }
    setLoading(false);
    // setGlbUrl('https://tripo-data.rg1.data.tripo3d.com/tcli_18bc76404eea44e8b2ff1ea8909106d1/20250522/45cd5f4c-842f-4144-bc0d-ad4f7e5ea952/tripo_pbr_model_45cd5f4c-842f-4144-bc0d-ad4f7e5ea952.glb?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly90cmlwby1kYXRhLnJnMS5kYXRhLnRyaXBvM2QuY29tL3RjbGlfMThiYzc2NDA0ZWVhNDRlOGIyZmYxZWE4OTA5MTA2ZDEvMjAyNTA1MjIvNDVjZDVmNGMtODQyZi00MTQ0LWJjMGQtYWQ0ZjdlNWVhOTUyL3RyaXBvX3Bicl9tb2RlbF80NWNkNWY0Yy04NDJmLTQxNDQtYmMwZC1hZDRmN2U1ZWE5NTIuZ2xiIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzQ3OTU4NDAwfX19XX0_&Signature=srzHw-o8d092Y0C965~vq5E4iMEv9QwJL7HLTh9N~vGVv7yCJEco3XEOBnBwG-ffn5mcZzSsB0IvxEEoGCm0FXhrGaZQ1P8fw9Dpn4JiUUBe~pgfBvtaMmPI0ZUo40u9EJjZhW6gmUHwrdvLoPjqnQnEsRKXUuiAL7QX3Uz4OcKWuk6wfsdQ-jVuhlWyOAK3AyAwYVLd8eW3FoPjyStnvh-Kt0xadpJzwY5D9bk9cg4KyfEeFg410o8oLDCxb37WFKj449nN-yWOYMsjZHLWg~smE4IcAN6lhBGpIXqfNSoxZxOpTzzJx47dQz-qgBjGN1csbmclGQSlCkOycy4cJA__&Key-Pair-Id=K1676C64NMVM2J');
  };

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.overlay}>
          <Text style={styles.progressText}>{`Đang tạo model: ${progress}%`}</Text>
        </View>
      )}

      {glbUrl && <ModelViewer modelUrl={glbUrl} />}

      {/* 🆕 Nhập URL ảnh và nút upload */}
      <View style={styles.bottomPanel}>
        <TextInput
          style={styles.input}
          placeholder="Nhập URL ảnh PNG"
          value={imageUrl}
          onChangeText={setImageUrl}
        />
        <Button title="Upload ảnh từ URL" onPress={handleGenerateModel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  progressText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  bottomPanel: {
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f9f9f9',
  },
  input: {
    borderWidth: 1,
    borderColor: '#aaa',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
});