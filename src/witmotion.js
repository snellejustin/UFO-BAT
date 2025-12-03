const WITMOTION_SERVICE_UUID = '0000ffe5-0000-1000-8000-00805f9a34fb';
const WITMOTION_NOTIFY_UUID = '0000ffe4-0000-1000-8000-00805f9a34fb';

export const sensorData = {
    isConnected: false,
    roll: 0, 
    pitch: 0, 
    yaw: 0
};

export async function connectToWitMotion() {
    try {
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'WT' }],
            optionalServices: [WITMOTION_SERVICE_UUID]
        });

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(WITMOTION_SERVICE_UUID);
        const characteristic = await service.getCharacteristic(WITMOTION_NOTIFY_UUID);

        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', handleSensorData);

        sensorData.isConnected = true;
        return true;

    } catch (error) {
        console.error(error);
        return false;
    }
}

function handleSensorData(event) {
    const value = event.target.value;
    const data = new DataView(value.buffer);

    //the sensor sends data in packets starting with 0x55.
    //we want the angle packet, which is 0x55 followed by 0x61.

    //check if this is an angle packet
    if (data.getUint8(0) === 0x55 && data.getUint8(1) === 0x61) {

        //rolling on x axies is at bytes 2 and 3
        const rawRoll = data.getInt16(2, true);
        const rollDegrees = (rawRoll / 32768.0) * 180.0;
        sensorData.roll = rollDegrees;

        //pitching on y axis is at bytes 4 and 5
        //const rawPitch = data.getInt16(4, true);
        //const pitchDegrees = (rawPitch / 32768.0) * 180.0;
        //sensorData.pitch = pitchDegrees;
    }
}