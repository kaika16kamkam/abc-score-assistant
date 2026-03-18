// ABC SCORE ASSISTANT - 共通ロジック

const showMidiUpload = () => {
  const section = document.getElementById('midiUploadSection')
  if (!section) return
  section.classList.remove('hidden')
  section.scrollIntoView({ behavior: 'smooth' })
}

document.getElementById('startMidiConvert')?.addEventListener('click', showMidiUpload)

document.getElementById('file').onchange = async (e) => {
  const file = e.target.files[0]
  if (!file) return

  try {
    const arrayBuffer = await file.arrayBuffer()
    document.getElementById('output').textContent =
      '読み込み成功: ' + file.name + '\n\n（ここにABC変換結果が表示されます）'
  } catch (err) {
    document.getElementById('output').textContent =
      'エラー: ' + err.message
  }
}
