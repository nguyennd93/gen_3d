import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import ModelViewer from '../../components/ModelViewer';


// API Key — dùng biến môi trường hoặc tách ra file config riêng nếu cần bảo mật
const TRIPO_API_KEY = 'tsk_t0QMQmzhD_23N5uDjCukHwrWTVu4srL85poatSoLZ5s';

async function generateGlbFromTripo(strPrompt: string): Promise<string | null> {
  try {
    const url = 'https://api.tripo3d.ai/v2/openapi/task';

    const data = {
      type: 'text_to_model',
      prompt: strPrompt
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
      console.log('Status: ', status);

      if (status === 'success') {
        const glbUrl = statusData.data?.output?.pbr_model;
        console.log(statusData);
        return glbUrl ?? null;
      }
      else if (status === 'failed') {
        console.error('❌ Generation failed:', statusData);
        return null;
      }
      else {
        console.log(statusData);
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

  useEffect(() => {
    const fetchModel = async () => {
      const url = await generateGlbFromTripo('a guy with red hat');
      setGlbUrl(url);
      setLoading(false);
    };
    fetchModel();
  }, []);

  return (
    <View style={styles.container}>
      <ModelViewer modelUrl={glbUrl}/>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});