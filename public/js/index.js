localforage.config({
    name: 'NeDB',
    storeName: 'nedbdata'
});

const {
    createApp,
    ref,
    onMounted,
    watch,
    computed,
} = Vue;

const app = createApp({
    setup() {
        const inputFileRef = ref();
        const admin = ref(false);
        const items = ref([]);
        const tableData = ref([]);
        const page = ref(1);
        const pageSize = ref(10);
        const total = ref(0);
        const searchText = ref('');
        const tableHeight = ref(400);
        onMounted(() => {
            tableHeight.value = document.documentElement.clientHeight - 140;
        })

        const changePage = (value) => {
            page.value = value;
            pagination()
        }
        const changePageSize = (value) => {
            page.value = 1;
            pageSize.value = value;
            pagination()
        }
        /**分页*/
        const pagination = () => {
            tableData.value = items.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value);
        }

        const parseURLSearchParams = () => {
            const params = new URLSearchParams(window.location.search);
            searchText.value = params.get('s') || '';
        }

        onMounted(() => {
            parseURLSearchParams()
            getData('/public/data.txt', (data) => {
                const decoder = new TextDecoder();
                localforage.setItem('mrpdb', decoder.decode(data), async (err, v) => {
                    try {
                        db.newDB();
                        await search();
                    } catch (err) {
                        console.log(err);
                    }
                });
            })
        })

        const showList = async () => {
            let cond = {};
            if (searchText.value) {
                const search = new RegExp(searchText.value);
                cond = {
                    $or: [
                        { DisplayName: search },
                        { Vendor: search },
                        { Desc: search }
                    ]
                };
            }

            items.value = await db.getData(cond, app.page, app.pageSize)
            total.value = items.value.length;
            pagination()
        }
        const search = async () => {
            page.value = 1;
            await showList();
        }
        watch(() => searchText.value, search)
        const del = async (item) => {
            try {
                await db.remove({ _id: item._id });
                await showList();
            } catch (err) {
                console.log(err);
            }
        }
        const importFile = () => {
            inputFileRef.value.click();
        }
        const downloadData = () => {
            localforage.getItem('mrpdb', (err, value) => {
                if (err) {
                    console.log(err);
                    return;
                }
                const encoder = new TextEncoder();
                const view = encoder.encode(value);
                download(view, "data.txt");
            });
        }

        const readFile = (file) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => {
                    reject(reader.error);
                }
                reader.onload = async () => {
                    const ret = mrp.readMrpInfo(new Uint8Array(reader.result));
                    ret.file = file.name;
                    delete ret.files;
                    try {
                        const r = await db.findOne({
                            DisplayName: ret.DisplayName,
                            Crc32: ret.Crc32
                        });
                        if (r) {
                            const message = "exists: " + ret.file;
                            console.log(message);
                            ElMessage.error(message);
                        } else {
                            await db.insert(ret)
                        }
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.readAsArrayBuffer(file);
            });
        }
        const readFiles = async () => {
            try {
                for (const file of inputFileRef.value.files) {
                    await readFile(file);
                }
                await showList();
            } catch (err) {
                console.error(err);
            }
        }

        const showSize = (size) => {
            const levelMap = {
                0: 'B',
                1: 'KB',
                2: 'MB',
            }
            let level = 0;
            while (size > 1024) {
                size /= 1024;
                level++;
            }
            return `${size.toFixed(2)}${levelMap[level]}`
        }

        const paginationLayout = computed(() => {
          const isMobile = document.documentElement.clientWidth < 768;
          if (isMobile) {
              return "total, sizes, prev, next"
          }
          return "total, sizes, prev, pager, next, jumper"
        })

        return {
            inputFileRef,
            admin,
            tableData,
            page,
            pageSize,
            total,
            searchText,
            tableHeight,
            paginationLayout,
            search,
            del,
            importFile,
            downloadData,
            changePage,
            changePageSize,
            readFiles,
            showSize,
        }
    },
});
app.use(ElementPlus);
app.mount('#app');
