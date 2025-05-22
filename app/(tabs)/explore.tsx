import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Button, Alert, TextInput } from 'react-native';
import ModelViewer from '../../components/ModelViewer';
import * as FileSystem from 'expo-file-system';

const TRIPO_API_KEY = 'tsk_2yp8CO1sAV54yEaiB3YYLKiY0hSUH63J4uIkdxPqTuA';

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

    // Step 2: Polling for result
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
  const [imageUrl, setImageUrl] = useState<string>('https://i.ibb.co/YFxKC6SC/batroom.png'); // 🆕 Default image URL

  const uploadFromImageUrl = async (imageUrl: string): Promise<string | null> => {
    try {
      if (!imageUrl) {
        Alert.alert('❌ Please enter image URL');
        return null;
      }

      // Step 2: Download image to local cache
      const filename = 'downloaded.png';
      const localPath = FileSystem.cacheDirectory + filename;

      // Step 3: Upload from local file
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
        console.error('❌ Upload failed:', json);
        Alert.alert('❌ Upload Error', JSON.stringify(json));
        return null;
      }

      console.log('✅ Upload successful:', json);
      return json.data?.image_token;
    } catch (err) {
      console.error('🔥 Upload error:', err);
      Alert.alert('❌ Error uploading image', String(err));
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
    // setGlbUrl('...'); // Optional hardcoded URL for testing
  };

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.overlay}>
          <Text style={styles.progressText}>{`Generating model: ${progress}%`}</Text>
        </View>
      )}

      {glbUrl && <ModelViewer modelUrl={glbUrl} />}

      {/* 🆕 Image URL input and upload button */}
      <View style={styles.bottomPanel}>
        <TextInput
          style={styles.input}
          placeholder="Enter PNG image URL"
          value={imageUrl}
          onChangeText={setImageUrl}
        />
        <Button title="Upload image from URL" onPress={handleGenerateModel} />
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
    color: 'black',
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