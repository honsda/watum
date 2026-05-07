export const entityDeleteCopy = {
	classroom: {
		fallbackLabel: 'ruang ini',
		message:
			'Ruang ini akan dihapus dari inventaris. Pastikan tidak ada jadwal aktif yang masih bergantung pada ruang ini.',
		confirmLabel: 'Ya, hapus ruang',
		successMessage: 'Ruang dihapus dari inventaris.',
		failureMessage: 'Ruang belum bisa dihapus. Periksa apakah ruang masih dipakai.'
	},
	course: {
		fallbackLabel: 'mata kuliah ini',
		message:
			'Mata kuliah ini akan dihapus dari katalog. Pastikan perubahan ini tidak mengganggu jadwal atau KRS yang masih aktif.',
		confirmLabel: 'Ya, hapus mata kuliah',
		successMessage: 'Mata kuliah dihapus dari katalog.',
		failureMessage: 'Mata kuliah belum bisa dihapus. Periksa jadwal dan KRS yang masih terkait.'
	},
	student: {
		fallbackLabel: 'mahasiswa ini',
		message:
			'Data mahasiswa ini akan dihapus dari data aktif. Pastikan identitas ini tidak lagi dipakai dalam proses akademik berjalan.',
		confirmLabel: 'Ya, hapus mahasiswa',
		successMessage: 'Mahasiswa dihapus dari data aktif.',
		failureMessage: 'Mahasiswa belum bisa dihapus. Periksa data yang masih terkait.'
	},
	lecturer: {
		fallbackLabel: 'dosen ini',
		message:
			'Dosen ini akan dihapus dari daftar pengampu. Pastikan jadwal, mata kuliah, dan akun terkait sudah diperiksa.',
		confirmLabel: 'Ya, hapus dosen',
		successMessage: 'Dosen dihapus dari daftar pengampu.',
		failureMessage: 'Dosen belum bisa dihapus. Periksa jadwal atau akun yang masih terhubung.'
	},
	faculty: {
		fallbackLabel: 'fakultas ini',
		message:
			'Fakultas ini akan dihapus dari struktur akademik. Pastikan tidak ada program studi aktif yang masih bergantung padanya.',
		confirmLabel: 'Ya, hapus fakultas',
		successMessage: 'Fakultas dihapus dari struktur akademik.',
		failureMessage: 'Fakultas belum bisa dihapus. Periksa program studi yang masih terkait.'
	},
	studyProgram: {
		fallbackLabel: 'program studi ini',
		message:
			'Program studi ini akan dihapus dari struktur akademik. Pastikan mahasiswa dan mata kuliah terkait sudah ditinjau.',
		confirmLabel: 'Ya, hapus program studi',
		successMessage: 'Program studi dihapus dari struktur akademik.',
		failureMessage: 'Program studi belum bisa dihapus. Periksa data yang masih terhubung.'
	},
	enrollment: {
		fallbackLabel: 'jadwal ini',
		message:
			'KRS dan jadwal ini akan dihapus dari periode aktif. Lanjutkan hanya jika perubahan ini sudah final.',
		confirmLabel: 'Ya, hapus jadwal',
		successMessage: 'Jadwal dihapus dari periode aktif.',
		failureMessage: 'Jadwal belum bisa dihapus. Periksa data KRS yang masih dipakai.'
	},
	grade: {
		fallbackLabel: 'nilai ini',
		message:
			'Nilai ini akan dihapus dari rekap hasil. Jika masih diperlukan, Anda perlu memasukkannya lagi setelah penghapusan.',
		confirmLabel: 'Ya, hapus nilai',
		successMessage: 'Nilai dihapus dari rekap hasil.',
		failureMessage: 'Nilai belum bisa dihapus. Periksa apakah data masih dipakai di rekap.'
	}
} as const;

export function buildEntityDeleteIntent<K extends keyof typeof entityDeleteCopy>(options: {
	kind: K;
	id: string;
	label: string | null | undefined;
}) {
	const copy = entityDeleteCopy[options.kind];
	return {
		kind: options.kind,
		id: options.id,
		label: options.label ?? copy.fallbackLabel,
		message: copy.message,
		confirmLabel: copy.confirmLabel,
		successMessage: copy.successMessage,
		failureMessage: copy.failureMessage
	};
}
