let socket = undefined

document.addEventListener('alpine:init', () => {
    Alpine.data('game', () => ({
        loading:true,
        watchIgnore:false,
        setting:{},

        presets : [
            {
                name:"默认",
                description:"默认的设置",
                setting:{
                    dayVoteType: "Majority",
                    dayLength: 1.2,
                    
                    enableTrial: false,
                    enableTrialDefense: true,
                    trialTime: 0.8,
                    pauseDayTimerDuringTrial: true,
                    
                    startAt: "day/No-Lynch",
                    
                    nightType: "Classic",
                    nightLength: 0.6,
                    
                    enableDiscussion: true,
                    discussionTime: 0.3,
                    
                    revealPlayerRoleOnDeath: true,
                    enableCustomName: true,
                    enableKillMessage: true,
                    enableLastWord: true,
                    enablePrivateMessage: true,
                    
                    roleSet: [
                        "Citizen", "Citizen", "Citizen", "Citizen", "Citizen",
                        "Citizen", "Citizen",
                        "Sheriff", "Sheriff", "Sheriff", "Sheriff",
                        "Mafioso", "Mafioso", "Mafioso", "Mafioso"
                    ],
                }
            }
        ],

        selectedPreset:undefined,

        async init() {
            this.setting = cloneDeep(this.presets[0].setting)
            this.socketInit()
            this.loading = false

            this.$watch('setting', (value, oldValue)=>{
                if(this.watchIgnore === false){
                    const event = {type:"HostChangesGameSetting",data:value}
                    socket?.send(JSON.stringify(event))
                }else{
                    this.watchIgnore = false
                }
            })
        },
        socketInit(){
            socket = window.top.socket
            window.top.game_onmessage = onMessage
        
            if(socket === undefined){
                console.log("调试模式，事件将不会被发送到服务器。")
                socket = {send:console.log}
            }

            window.addEventListener('HostChangesGameSetting', (e) => {
                this.watchIgnore = true
                this.setting = e.detail
            })
        },
        selectPreset(preset){
            this.selectedPreset = preset
        },
        useSelectedPreset(){
            if(this.selectedPreset??false)
                this.setting = cloneDeep(this.selectedPreset.setting)
        },
        importSetting(){
            let importJsonString = prompt("请输入导出字符串: ")
            if(typeof(importJsonString) === 'string'){
                try{
                    this.setting = JSON.parse(window.atob(importJsonString))
                }catch(e){
                    alert("导入错误，请重试。")
                }
            }
        },
        exportSetting(){
            let s = JSON.stringify(this.setting);
            let exportString = window.btoa(s)
            alert("导出结果为: \n\n" + exportString);
        }
    }))

    function cloneDeep(o){
        return JSON.parse(JSON.stringify(o))
    }

    function onMessage(e){
        const event = JSON.parse(e.data)
        window.dispatchEvent(new CustomEvent(event.type, { detail:event.data }))
    }
})