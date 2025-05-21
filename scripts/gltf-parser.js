import { TextDecoder } from 'text-encoding';

export function parseGlb(arrayBuffer) {
    const dataView = new DataView(arrayBuffer);

    const textDecoder = new TextDecoder('utf-8');

    // GLB header
    const magic = dataView.getUint32(0, true);
    const version = dataView.getUint32(4, true);
    const length = dataView.getUint32(8, true);

    if (magic !== 0x46546C67) throw new Error('Invalid GLB header');

    // First chunk (JSON)
    const jsonChunkLength = dataView.getUint32(12, true);
    const jsonChunkType = dataView.getUint32(16, true);

    const jsonText = textDecoder.decode(new Uint8Array(arrayBuffer, 20, jsonChunkLength));
    const gltf = JSON.parse(jsonText);

    // Second chunk (binary buffer)
    const binChunkHeader = 20 + jsonChunkLength;
    const binChunkLength = dataView.getUint32(binChunkHeader, true);
    const binChunkType = dataView.getUint32(binChunkHeader + 4, true);

    const binChunkDataStart = binChunkHeader + 8;
    const binBuffer = arrayBuffer.slice(binChunkDataStart, binChunkDataStart + binChunkLength);

    const accessorData = (accessorIndex) => {
        const accessor = gltf.accessors[accessorIndex];
        const bufferView = gltf.bufferViews[accessor.bufferView];
        const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
        const componentType = accessor.componentType;
        const count = accessor.count;
        const type = accessor.type;

        let numComponents = 3;
        if (type === 'VEC2') numComponents = 2;
        else if (type === 'VEC4') numComponents = 4;

        let arrayType = Float32Array;
        if (componentType === 5123) arrayType = Uint16Array;
        else if (componentType === 5126) arrayType = Float32Array;

        const elementSize = arrayType.BYTES_PER_ELEMENT * numComponents;
        const dataSlice = new arrayType(binBuffer, bufferView.byteOffset || 0, count * numComponents);

        return Array.from(dataSlice);
    };

    const mesh = gltf.meshes[0];
    const primitive = mesh.primitives[0];

    const positions = accessorData(primitive.attributes.POSITION);
    const normals = accessorData(primitive.attributes.NORMAL);
    const uvs = primitive.attributes.TEXCOORD_0 != null
        ? accessorData(primitive.attributes.TEXCOORD_0)
        : null;

    let texture = null;
    if (primitive.material != null) {
        const material = gltf.materials[primitive.material];
        if (material.pbrMetallicRoughness && material.pbrMetallicRoughness.baseColorTexture) {
            const textureIndex = material.pbrMetallicRoughness.baseColorTexture.index;
            const textureDef = gltf.textures[textureIndex];
            const imageDef = gltf.images[textureDef.source];
            const imageBufferView = gltf.bufferViews[imageDef.bufferView];
            const imageData = new Uint8Array(binBuffer, imageBufferView.byteOffset, imageBufferView.byteLength);

            texture = {
                pixels: imageData,
                width: 256, // 🔧 bạn nên trích từ image header thực tế
                height: 256
            };
        }
    }

    return {
        meshes: [{
            positions,
            normals,
            uvs,
            texture
        }]
    };
}